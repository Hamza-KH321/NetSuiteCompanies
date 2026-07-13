/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
define(['N/crypto', 'N/encode'], function (crypto, encode) {

    const SECRET_GUID = 'custsecret_vs_login_secret';
    const EXPIRY_DURATION_MINUTES = 120;

    function generateUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function createToken(payload) {
        const secretKey = crypto.createSecretKey({
            guid: SECRET_GUID,
            encoding: encode.Encoding.UTF_8
        });

        // Add expiry and randomness
        payload.exp = Date.now() + EXPIRY_DURATION_MINUTES * 60 * 1000; // e.g., expires in 30 seconds
        payload.nonce = generateUuid(); // randomness

        const json = JSON.stringify(payload);

        const base64 = encode.convert({
            string: json,
            inputEncoding: encode.Encoding.UTF_8,
            outputEncoding: encode.Encoding.BASE_64
        });

        const hmac = crypto.createHmac({
            algorithm: crypto.HashAlg.SHA256,
            key: secretKey
        });

        hmac.update({
            input: json,
            inputEncoding: encode.Encoding.UTF_8
        });

        const digest = hmac.digest({ outputEncoding: encode.Encoding.HEX });

        return encodeURIComponent(`${base64}|${digest}`);
    }

    function verifyToken(token) {
        try {
            // can you show me how much time is left on the token?


            const [base64, hash] = decodeURIComponent(token).split('|');

            const json = encode.convert({
                string: base64,
                inputEncoding: encode.Encoding.BASE_64,
                outputEncoding: encode.Encoding.UTF_8
            });

            const data = JSON.parse(json);

            // Expiry check
            if (!data.exp || Date.now() > data.exp) {
                log.error('Token expired', 'Token has expired or is invalid.');
                return null;
            }

            const secretKey = crypto.createSecretKey({
                guid: SECRET_GUID,
                encoding: encode.Encoding.UTF_8
            });

            const hmac = crypto.createHmac({
                algorithm: crypto.HashAlg.SHA256,
                key: secretKey
            });

            hmac.update({
                input: json,
                inputEncoding: encode.Encoding.UTF_8
            });

            const expectedHash = hmac.digest({ outputEncoding: encode.Encoding.HEX });

            return expectedHash === hash ? data : null;
        } catch (e) {
            return null;
        }
    }

    return {
        createToken,
        verifyToken
    };
});
