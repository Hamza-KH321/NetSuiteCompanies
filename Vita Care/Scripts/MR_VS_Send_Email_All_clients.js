/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/email', 'N/log'], (search, email, log) => {

    function getInputData() {
        return search.create({
            type: "customer",
            filters: [
                ["isinactive", "is", "F"],
                "AND",
                ["email", "isnotempty", ""],
                // "AND",
                // ["internalid", "anyof", "19", "33"]
            ],
            columns: [
                search.createColumn({ name: "internalid" }),
                search.createColumn({ name: "email" })
            ]
        });
    }

    function map(context) {
        try {
            var result = JSON.parse(context.value);
            var customerId = result.values.internalid.value;
            var emailAddr = result.values.email;

            var subject = "ابدأ باستخدام وصفتي فورًا – بدون الحاجة لتغيير نظامك الحالي";

            var body = `
                <div dir="rtl" style="text-align:right; font-family:Tahoma, Arial, sans-serif; font-size:14px;">
                     حابب تشغّل "وصفتي" بشكل منفصل؟ <br/>
                     استمتع بخدمة وصفتي بدون ما تغيّر نظامك الحالي.<br/><br/>

                    ⚡ مزايا فورية :<br/>
                    ✅ استلام الفواتير تلقائيًا<br/>
                    ✅ صرف الوصفات مباشرة<br/>
                    ✅ متابعة دقيقة للمخزون<br/>
                    ✅ تقارير شاملة وفورية<br/><br/>

                    ✨ انطلق الآن… سهولة وسرعة بلمسة واحدة !<br/>
                    احجز معنا الان :- 920033678<br/><br/>

                    اضغط على الرابط حتى تحجز موعد عرض تجريبي للنظام :- 
                    <a href="https://appt.link/vita-gaurdian-member/vita-gaurdian-demonstration" target="_blank">
                        اضغط هنا للحجز
                    </a>
                </div>
            `;

            email.send({
                author: 373455,
                recipients: emailAddr,
                subject: subject,
                body: body
            });

            log.audit("Email sent", `Customer ${customerId} - ${emailAddr}`);
        } catch (e) {
            log.error("Error in map", e);
        }
    }

    return { getInputData, map };
});
