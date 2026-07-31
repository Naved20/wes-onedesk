## Diagnosis (no changes made)

Face Hub ka camera, login aur backend sab theek hai — problem browser me face models load hone par crash ho rahi hai, isliye scan hi start nahi hota.

### Evidence collected

1. **Backend healthy** — `face-hub-checkin` function live hai, direct call par HTTP 200 + valid history return kar raha hai. `face_descriptors` me 37 active enrollments (sab 128-length, koi null nahi).
2. **Check-ins ek exact date par ruke** — `attendance` me face check-ins 1 Jul se 29 Jul tak roz 20–26 rows, 30/31 Jul par **zero**. `face_checkin_history` ka last row bhi 29 Jul 11:29. Sessions 30–31 Jul par active the, matlab log kiosk khol rahe the par scan attempt server tak pahunch hi nahi raha.
3. **Live browser test (`/face-hub`)** — page render hota hai, camera stream ready (1280x1280, readyState 4), lekin UI par permanently "Loading face models..." aur **"Scan Face & Check-in" button disabled**. `modelsReady` kabhi `true` nahi hota.
4. **Model files fine** — CDN se saare weights 200 aate hain (manifest + shards).
5. **Actual error** — `loadFaceModels()` ko directly call karne par:
   ```text
   ERR: Lt2.makeTensor is not a function
   ```
   plus console warnings: "webgl backend was already registered", "cpu backend was already registered", "Platform browser has already been set."

### Root cause

`node_modules` me TensorFlow.js ki **do copies** install hain:

```text
node_modules/@tensorflow/tfjs-core                                  -> 1.2.2   (face-api.js ka exact pin)
node_modules/tfjs-image-recognition-base/node_modules/@tensorflow/tfjs-core -> 1.7.0  (^1.2.9 range se resolve)
```

- `face-api.js@0.20.1` `@tensorflow/tfjs-core@1.2.2` pin karta hai.
- Uski dependency `tfjs-image-recognition-base` `^1.2.9` maangti hai, to uske liye alag nested 1.7.0 install hua.
- 1.2.2 ke engine me `makeTensor` method **exist hi nahi karta**; 1.7.0 me karta hai. Weight-loading code 1.7.0 copy se aata hai par engine/backend 1.2.2 copy ka register hota hai (duplicate backend registration warnings isi ka proof hain) → `makeTensor is not a function` throw hota hai.
- `loadFaceModels()` apna failed promise cache kar leta hai, aur error sirf ek toast me jaata hai, isliye button hamesha disabled rehta hai aur user ko clear reason nahi dikhta.

Ye break kisi UI ya DB change se nahi, **dependency re-resolution** (fresh install / lockfile update) se aaya — code path 29 Jul tak same tha aur kaam kar raha tha.

### Ek chhota secondary issue (asli cause nahi)

- `supabase/config.toml` me `face-hub-checkin` ke liye entry nahi hai (JWT verify default on) — anon key se abhi kaam kar raha hai, so blocking nahi.
- "No face detected" case me client seedha `face_checkin_history` me insert karta hai aur error ignore karta hai — anon RLS block hone par ye silently drop hota hai.

### Fix options (aapke kehne par implement karunga)

1. **Pin ek hi TFJS copy** — `package.json` me `@tensorflow/tfjs-core` ko `1.7.0` par pin karke overrides/resolutions se nested copy hata dena (sabse chhota, targeted fix).
2. **`@vladmandic/face-api` par migrate** — maintained fork jo modern TFJS ke saath ship hota hai (thoda bada change, long-term stable).
3. Saath me: model-load failure par UI par visible error + "Retry" button, aur `loadFaceModels()` me failed promise cache na karna.
