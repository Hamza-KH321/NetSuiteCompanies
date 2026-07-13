/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/crypto', 'N/encode'], function (crypto, encode) {

    function getInputData() {

try {

    function toHmacSHA256Base64(toCrypt, key) {
        var inputString = toCrypt;
        var mySecret = key;
        // var sKey = crypto.createSecretKey({
        //     secret: mySecret,
        //     encoding: encode.Encoding.UTF_8
        // });
        log.debug('mySecret', mySecret);
        log.debug('inp', inputString);
        var hmacSHA256 = crypto.createHmac({
            algorithm: 'SHA256',
            key: mySecret
        });
        log.debug('hmacSHA256' , hmacSHA256);
        hmacSHA256.update({
            input: inputString,
            inputEncoding: encode.Encoding.BASE_64
        });
        var digestSHA256 = hmacSHA256.digest({
            outputEncoding: encode.Encoding.HEX
        });
        log.debu('digestSHA256' , digestSHA256);
        return digestSHA256;
};

            var secret_key = '5c288a071012c5bb'
            var timestamp= '1698131222'
            var location_key= 'ff4b850c6681e874a8a26a556ddd5dc2';
            var token = location_key+timestamp;
            var nonce = toHmacSHA256Base64(token,secret_key)
            log.debug('nonce ' , nonce);
    

} catch (error) {
    log.error('error is ' ,error)
    
}

    }

    
    function map(context) {

    }
    
    function reduce(context) {
        // Your reduce logic here (if needed)
    }

    function summarize(summary) {
        // Your summarize logic here (if needed)
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
