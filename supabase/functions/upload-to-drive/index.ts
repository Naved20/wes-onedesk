const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-supabase-api-version",
};

// Root folder/shared-drive ID where everything goes
const ROOT_FOLDER_ID = "19nsvyQaW1PLEA9DzKWQYib_FLikW3FF4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const taskName = (formData.get("taskName") as string) || "Task";
    const userName = (formData.get("userName") as string) || "User";
    const submissionType = (formData.get("submissionType") as string) || "Submission";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided in form-data" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const accessToken = await getGoogleAccessToken(serviceAccount);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Failed to get Google Access Token" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Folder hierarchy under ROOT_FOLDER_ID -> Task -> User
    const taskFolderId = await getOrCreateFolder(taskName, ROOT_FOLDER_ID, accessToken);
    const userFolderId = await getOrCreateFolder(userName, taskFolderId, accessToken);

    const fileExt = file.name.split(".").pop() || "";
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const sanitizeName = (str: string) => str.trim().replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
    const newFileName = `${sanitizeName(taskName)}_${sanitizeName(userName)}_${sanitizeName(submissionType)}_${timestamp}.${fileExt}`;

    const uploadUrl =
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink";

    const metadata = {
      name: newFileName,
      mimeType: file.type,
      parents: [userFolderId],
    };

    const uploadFormData = new FormData();
    uploadFormData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    uploadFormData.append("file", file);

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Google Drive Upload Error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to upload file to Google Drive", details: errorText }),
        { status: 500, headers: corsHeaders }
      );
    }

    const uploadedFile = await uploadResponse.json();
    const fileId = uploadedFile.id;

    const permissionUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`;
    const permissionResponse = await fetch(permissionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });

    if (!permissionResponse.ok) {
      console.warn("Failed to make file public:", await permissionResponse.text());
    }

    const directViewLink = `https://drive.google.com/uc?export=view&id=${fileId}`;
    const folderPath = `${taskName} > ${userName}`;

    return new Response(
      JSON.stringify({
        fileId,
        fileName: newFileName,
        webViewLink: uploadedFile.webViewLink,
        directViewLink,
        folderPath,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in upload-to-drive:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: corsHeaders });
  }
});

async function getOrCreateFolder(folderName: string, parentId: string, accessToken: string): Promise<string> {
  const sanitizedName = folderName.replace(/'/g, "\\'");
  const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${sanitizedName}' and '${parentId}' in parents and trashed = false`;

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`;
  const searchResponse = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchResponse.ok) {
    throw new Error(`Failed to search folder: ${await searchResponse.text()}`);
  }

  const searchData = await searchResponse.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createUrl = "https://www.googleapis.com/drive/v3/files?fields=id,name&supportsAllDrives=true";
  const metadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentId],
  };

  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!createResponse.ok) {
    throw new Error(`Failed to create folder: ${await createResponse.text()}`);
  }

  const createData = await createResponse.json();
  return createData.id;
}

function pemToDer(pem: string): Uint8Array {
  const pemContents = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");

  const binary = atob(pemContents);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getGoogleAccessToken(serviceAccount: any): Promise<string | null> {
  try {
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const base64UrlEncode = (str: string) =>
      btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;

    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToDer(serviceAccount.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(signatureInput)
    );

    const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const jwt = `${signatureInput}.${signatureEncoded}`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      console.error("Failed to get access token:", tokenData.error);
      return null;
    }
    return tokenData.access_token;
  } catch (error) {
    console.error("Error getting Google access token:", error);
    return null;
  }
}
