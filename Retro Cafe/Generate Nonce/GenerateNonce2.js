/** 
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/crypto','N/encode'], function (crypto,encode) {

    function getInputData() {
        try {

            var locationKey = 'ff4b850c6681e874a8a26a556ddd5dc2';
            var secretKey = '5c288a071012c5bb';
            var timestamp = Math.floor(new Date().getTime() / 1000);
            var combinedData = locationKey +  timestamp;
            var nonce = createSecureKeyWithHash(combinedData,secretKey);
            
            nonce = nonce.toLowerCase();
            log.debug('timestamp is ' , timestamp);
            log.debug('combinedData is ' , combinedData);
            log.debug('nonce is ' , nonce);

        } catch (e) {
            log.error('error is ', e);
        }

    }
    function createSecureKeyWithHash(input, key) {

        var secretKey = crypto.createSecretKey({
            encoding: crypto.Encoding.UTF_8,
            secret: 'custsecret_vs_retrosecretkey'  // Replace with the script ID from API Secrets
        });
        log.debug({
            title: "Secret Key Details",
            details: JSON.stringify(secretKey) // This will log the details of the secret key object
        });
        var hash = crypto.createHmac({
            algorithm: crypto.HashAlg.SHA256,
            key: secretKey
        });
        hash.update({
            input: input
        });
        return hash.digest({
            outputEncoding: crypto.Encoding.HEX
        });
    }

    function map(context) {

    }

    function reduce(context) {
        // Your reduce logic here
    }

    function summarize(summary) {
        // Your summarize logic here
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});

