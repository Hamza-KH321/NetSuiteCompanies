/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @ScriptName SL || POS Order Creation
 */
define(['N/search', 'N/file', 'N/record', 'N/log', 'POS/POS_LIB/POS_SessionLib.js'],
    function (search, file, record, log, sessionLib) {

        function onRequest(context) {
            try {
                var request = context.request;
                var response = context.response;

                // =====================================================
                // AUTH GUARD (shared lib)
                // =====================================================
                var guard = sessionLib.requireSession(context);
                if (!guard.allowed) {
                    return;
                }

                // var session = guard.session; // if you need employeeId later

                /* =====================================================
                   GET: LOAD POS PAGE
                   ===================================================== */
                if (request.method === 'GET') {
                    log.debug('POS Order Creation', 'Loading POS page');

                    // 1. Load POS Items
                    var items = getPosItems();
                    log.debug('POS Items Loaded', items.length);

                    // 2. Load POS Categories
                    var categories = getPosCategories();
                    log.debug('POS Categories Loaded', categories.length);

                    // 3. Load POS Payment Methods
                    var paymentMethods = getPosPaymentMethods();
                    log.debug('POS Payment Methods Loaded', paymentMethods.length);

                    // 4. Load HTML + CSS
                    var htmlFile = file.load({ id: 'POS/POS_HTML/POS_Order_Creation.html' });
                    var cssFile = file.load({ id: 'POS/POS_CSS/POS_Order_Creation.css' });
                    var cssUrl = cssFile.url;

                    var html = htmlFile.getContents();
                    html = html.replace(
                        '<link rel="stylesheet" href="POS_Order_Creation.css">',
                        '<link rel="stylesheet" href="' + cssUrl + '">'
                    );

                    // 5. Inject data
                    var injectedScript =
                        '<script>' +
                        'window.POS_ITEMS = ' + JSON.stringify(items) + ';' +
                        'window.POS_CATEGORIES = ' + JSON.stringify(categories) + ';' +
                        'window.POS_PAYMENT_METHODS = ' + JSON.stringify(paymentMethods) + ';' +
                        'console.log("[POS] Items:", window.POS_ITEMS.length);' +
                        'console.log("[POS] Categories:", window.POS_CATEGORIES.length);' +
                        'console.log("[POS] Payment Methods:", window.POS_PAYMENT_METHODS.length);' +
                        '</script>';

                    html = html.replace('</head>', injectedScript + '</head>');

                    response.setHeader({ name: 'Content-Type', value: 'text/html; charset=UTF-8' });
                    response.write(html);
                    return;
                }

                /* =====================================================
                   POST: SUBMIT POS ORDER
                   ===================================================== */
                if (request.method === 'POST') {
                    response.setHeader({ name: 'Content-Type', value: 'application/json' });

                    try {
                        var body = JSON.parse(request.body || '{}');
                        log.debug('POS Checkout Payload', body);

                        if (!body.header || !body.lines || !body.lines.length) {
                            response.write(JSON.stringify({ success: false, message: 'Invalid order data' }));
                            return;
                        }

                        var queueRec = record.create({ type: 'customrecord_vs_pos_transaction_queue', isDynamic: true });

                        queueRec.setValue({ fieldId: 'custrecord_vs_postranqueue_status', value: 1 });
                        queueRec.setValue({ fieldId: 'custrecord_vs_postranqueue_tran_json', value: JSON.stringify(body) });

                        var recId = queueRec.save();

                        log.debug('POS Order Queued', 'Record ID: ' + recId);

                        response.write(JSON.stringify({ success: true, recordId: recId }));
                        return;

                    } catch (e) {
                        logPosError(e, 'POS_CHECKOUT_POST');

                        response.write(JSON.stringify({
                            success: false,
                            message: 'System error while creating order'
                        }));
                        return;
                    }
                }

            } catch (e) {
                logPosError(e, 'POS_SUITELET_FATAL');

                try {
                    context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
                } catch (e2) { }

                context.response.write(JSON.stringify({ success: false, message: 'Unexpected system error' }));
            }
        }

        /* =====================================================
           FETCH POS ITEMS
           ===================================================== */
        function getPosItems() {
            var items = [];

            try {
                var itemSearch = search.create({
                    type: search.Type.ITEM,
                    filters: [
                        ['custitem_vs_pos_item', 'is', 'T']
                    ],
                    columns: [
                        'internalid',
                        'itemid',
                        'displayname',
                        'salesdescription',
                        'baseprice',
                        'custitem_vs_pos_item_image',
                        'custitem_vs_pos_category'
                    ]
                });

                itemSearch.run().each(function (res) {

                    var imageFileId = res.getValue('custitem_vs_pos_item_image');
                    var imageUrl = '';

                    if (imageFileId) {
                        try {
                            var fileObj = file.load({ id: imageFileId });
                            imageUrl = fileObj.url;
                        } catch (e) {
                            log.error('Image load failed', e);
                        }
                    }

                    items.push({
                        internalid: res.getValue('internalid'),
                        itemid: res.getValue('itemid'),
                        displayname: res.getValue('displayname'),
                        salesdescription: res.getValue('salesdescription'),
                        baseprice: res.getValue('baseprice'),
                        image: imageUrl,
                        itemCategory: res.getText('custitem_vs_pos_category')
                    });

                    return true;
                });
            } catch (e) {
                logPosError(e, 'GET_POS_ITEMS');
            }

            return items;
        }

        /* =====================================================
           FETCH POS CATEGORIES
           ===================================================== */
        function getPosCategories() {
            var categories = [];

            try {
                var categorySearch = search.create({
                    type: 'customlist_vs_pos_categroy',
                    columns: [
                        search.createColumn({ name: 'name' })
                    ]
                });

                categorySearch.run().each(function (res) {
                    categories.push(res.getValue('name'));
                    return true;
                });
            } catch (e) {
                logPosError(e, 'GET_POS_CATEGORIES');
            }

            return categories;
        }

        /* =====================================================
           FETCH POS PAYMENT METHODS
           Returns: [{ id: internalid, name: altname }]
           ===================================================== */
        function getPosPaymentMethods() {
            var methods = [];

            try {
                var customerSearchObj = search.create({
                    type: "customer",
                    filters: [
                        ["custentity_vs_pos_customer", "is", "T"]
                    ],
                    columns: [
                        search.createColumn({ name: "internalid" }),
                        search.createColumn({ name: "altname" })
                    ]
                });

                customerSearchObj.run().each(function (res) {
                    var id = res.getValue({ name: 'internalid' });
                    var name = res.getValue({ name: 'altname' });

                    if (id && name) {
                        methods.push({
                            id: id,
                            name: name
                        });
                    }

                    return true;
                });
            } catch (e) {
                logPosError(e, 'GET_POS_PAYMENT_METHODS');
            }

            return methods;
        }

        /* =====================================================
           ERROR LOGGING
           ===================================================== */
        function logPosError(error, contextLabel) {
            try {
                log.error('POS ERROR - ' + contextLabel, error);

                var errRec = record.create({ type: 'customrecord_vs_pos_error_log', isDynamic: true });

                errRec.setValue({ fieldId: 'custrecord_vs_poserrorlog_error', value: error.name || contextLabel });
                errRec.setValue({ fieldId: 'custrecord_vs_poserrorlog_error_message', value: error.message || JSON.stringify(error) });

                errRec.save();
            } catch (loggingError) {
                log.error('FAILED TO LOG POS ERROR', loggingError);
            }
        }

        return {
            onRequest: onRequest
        };
    });
