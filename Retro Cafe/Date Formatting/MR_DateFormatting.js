/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/crypto', 'N/encode'], function (crypto, encode) {


    function getInputData() {
        try {
            // function sha256(input) {
            //     var hash = crypto.createHash({
            //         algorithm: crypto.HashAlg.SHA256 
            //     });
            //     hash.update({
            //         input: input
            //     });
            //     return hash.digest({
            //         outputEncoding: crypto.Encoding.HEX
            //     });
            // }

        //     function toHmacSHA256Base64(toCrypt, key) {
        //         var inputString = toCrypt;
        //         var myGuid = key;
        //         var sKey = crypto.createSecretKey({
        //             guid: myGuid,
        //             encoding: encode.Encoding.UTF_8
        //         });
        //         //Add additional code 

        //         var hmacSHA256 = crypto.createHmac({
        //             algorithm: 'SHA256',
        //             key: sKey
        //         });
        //         hmacSHA256.update({
        //             input: inputString,
        //             inputEncoding: encode.Encoding.BASE_64
        //         });
        //         var digestSHA256 = hmacSHA256.digest({
        //             outputEncoding: encode.Encoding.HEX
        //         });
        //         return digestSHA256;
        // };


        // function toHmacSHA256Base64(toCrypt, key) {
        //     var hmacSHA256 = crypto.createHmac({
        //         algorithm: 'SHA256',
        //         key: key
        //     });
        //     hmacSHA256.update({
        //         input: toCrypt,
        //         inputEncoding: crypto.Encoding.UTF_8 // Specify input encoding here
        //     });
        //     var digestSHA256 = hmacSHA256.digest({
        //         outputEncoding: crypto.Encoding.BASE_64 // Specify output encoding here
        //     });
        //     return digestSHA256;
        // }

            // Date Formatting 
            var timestamp = new Date();
            var timestamp2 = timestamp.toUTCString()
            var today = new Date();
            var dayOfWeek = today.getDay();
            var daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            var monthNames = 
            ["January", "February", "March", "April", "May", "June", "July",
            "August", "September", "October", "November", "December"
              ];
            var todayName = daysOfWeek[dayOfWeek];
            var currentMonth = today.getMonth();
            var monthName = monthNames[currentMonth];
            var day = today.getDate();
            var year = today.getFullYear();
            var hours = today.getHours();
            var minutes = today.getMinutes();
            var seconds = today.getSeconds();
            var period = hours >= 12 ? "PM" : "AM";
            var formattedDate = todayName.concat(', ', monthName, ' ', day, ', ', year, ', ', hours, ':', minutes, ':', seconds, ' ', period, ' ', 'UTC');
            var parseDate = new Date(formattedDate);
            var unixDate = parseDate.getTime() / 1000;

            log.debug('Today is ' , todayName);
            log.debug('Month is ' , monthName);
            log.debug('Day is ' , day);
            log.debug('Year is ' , year);
            log.debug('hours is ' , hours);
            log.debug('minutes is ' , minutes);
            log.debug('seconds is ' , seconds);
            log.debug('period is ' , period);
            log.debug('formattedDate is ' , formattedDate);
            log.debug('parseDate is ' , parseDate);
            log.debug('unixDate is ' , unixDate);
            log.debug('timestamp2 is ' , timestamp2);

            var secretKey = '5c288a071012c5bb';
            var locationKey = 'ff4b850c6681e874a8a26a556ddd5dc2';
            var token = (locationKey + timestamp2).toString();
            // var combinedData = locationKey +  timestamp + secretKey ;
            // var nonce = toHmacSHA256Base64(token,secretKey);

            log.debug('timestamp is ' , timestamp2);
            log.debug('token is ' , token);
            // log.debug('nonce is ' , nonce);
            var currentDate = new Date();
            var unixTimestamp = currentDate.getTime();

            log.debug('unixTimestamp is ', unixTimestamp);
        } catch (error) {
            log.error('error is ', error);
        }

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