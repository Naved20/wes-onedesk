import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get Service Account credentials from Environment
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    // Get the multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folderId = formData.get("folderId") as string || undefined;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided in form-data" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Get Access Token for Google Drive API
    const accessToken = await getGoogleAccessToken(serviceAccount);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Failed to get Google Access Token" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 2. Upload file to Google Drive
    const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";
    
    const metadata = {
      name: file.name,
      mimeType: file.type,
      ...(folderId && { parents: [folderId] }),
    };

    const uploadFormData = new FormData();
    uploadFormData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    uploadFormData.append("file", file);

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
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

    // 3. Make file public (anyone with the link can view)
    const permissionUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
    const permissionResponse = await fetch(permissionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone",
      }),
    });

    if (!permissionResponse.ok) {
      console.warn("Failed to make file public, link might not be accessible without permissions");
    }

    // Return the public webViewLink
    return new Response(
      JSON.stringify({
        id: fileId,
        name: file.name,
        webViewLink: uploadedFile.webViewLink,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in upload-to-drive:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// Helper: Convert PEM key to DER format
function pemToDer(pem: string): Uint8Array {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s+/g, "");
  
  const binary = atob(pemContents);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper: Generate JWT and fetch Google Access Token
async function getGoogleAccessToken(serviceAccount: any): Promise<string | null> {
  try {
    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const encoder = new TextEncoder();
    
    // Custom URL-safe Base64 encode helper
    const base64UrlEncode = (str: string) => {
      const b64 = btoa(str);
      return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };

    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));

    const signatureInput = `${headerEncoded}.${payloadEncoded}`;
    const signatureInputBytes = encoder.encode(signatureInput);

    const privateKey = serviceAccount.private_key;
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToDer(privateKey),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      signatureInputBytes
    );

    const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const jwt = `${signatureInput}.${signatureEncoded}`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

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
