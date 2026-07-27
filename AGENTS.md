# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Strict Biometrics Requirement
- DO NOT use the phone's native local biometrics (such as `expo-local-authentication` or any FaceID/Fingerprint scan of the mobile phone device itself) for clocking in or out.
- The mobile app MUST only wait for physical biometrics validation from the wall-mounted office biometric machine (registered via Supabase `physical_biometric_scans` table updates/realtime subscriptions).
