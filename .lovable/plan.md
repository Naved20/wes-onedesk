# Face ID Management: photos not showing

## Why it happens

Data theek hai — jo bhi check kiya:

- `face_descriptors` me 38 rows, sabhi me `photo_url` set hai.
- `face-enrollments` bucket public hai, 76 objects maujood hain, aur ek sample URL direct fetch par `200 image/jpeg` deta hai.
- RLS bhi block nahi kar raha: authenticated users active descriptors read kar sakte hain.

Asli reason ek security header hai. App har response par `Cross-Origin-Embedder-Policy: require-corp` bhejti hai (`vite.config.ts`, `public/_headers`, `netlify.toml`, `vercel.json`) — ye WebCodecs/ffmpeg (SharedArrayBuffer) ke liye lagaya gaya tha.

`require-corp` ke tehat browser sirf woh cross-origin sub-resources load karta hai jo ya `Cross-Origin-Resource-Policy` header bhejte hain, ya CORS mode me maange gaye ho. Storage image response me CORP header nahi hai, aur `<img src={emp.photo_url}>` (line 533, `src/pages/FaceIdManagement.tsx`) bina `crossOrigin` attribute ke plain no-cors request karta hai → browser image block kar deta hai, isliye avatar khali/blank dikhta hai.

Good news: storage `access-control-allow-origin: *` bhejta hai, to CORS-mode request allowed hai.

## Fix

1. `src/pages/FaceIdManagement.tsx` ke avatar `<img>` par `crossOrigin="anonymous"` add karna (isse request CORS mode me jaati hai, jo COEP `require-corp` ke saath allowed hai) + `loading="lazy"` aur `onError` fallback (image fail ho to initials wala circle dikhe).
2. Poore app me scan karke baaki cross-origin storage/CDN `<img>` tags par bhi wahi treatment (Face Hub, Face Attendance, documents/announcements previews) — taaki same header dubara kisi aur page par blank image na de.
3. Ek chhota shared avatar/image component ya helper use karke duplication avoid karna, agar 3 se zyada jagah affected hain.

Koi database, RLS ya bucket change ki zarurat nahi; headers bhi jaise hain waise rahenge (ffmpeg/WebCodecs feature toot na jaye).

## Technical notes

- Affected file (confirmed): `src/pages/FaceIdManagement.tsx` line ~533.
- COEP sources: `vite.config.ts` (dev), `public/_headers`, `netlify.toml`, `vercel.json` (prod). Inhe hataana bhi ek option hai, par usse video compression ka SharedArrayBuffer path break hoga — isliye recommended approach `crossOrigin` attribute hai.
- Verification: browser me `/face-id-management` load karke console ki `ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep` errors gayab hone chahiye aur avatars render hone chahiye.
