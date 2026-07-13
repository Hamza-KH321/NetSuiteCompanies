/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/llm', 'N/log'], function (ui, llm, log) {

    function onRequest(context) {

        if (context.request.method === 'GET') {

            log.debug("LLM Keys", Object.keys(llm));

            var form = ui.createForm({ title: 'AI Assistant (LLM)' });
            form.addField({
                id: 'custpage_prompt',
                type: ui.FieldType.TEXTAREA,
                label: 'Enter your question'
            });

            form.addSubmitButton('Ask');
            context.response.writePage(form);
            return;
        }

        // POST
        try {
            var prompt = context.request.parameters.custpage_prompt;

            var result = llm.generateText({
                model: llm.ModelFamily.COHERE_COMMAND_R,
                prompt: prompt,
                maxTokens: 200
            });

            log.debug("RAW LLM RESULT", result);

            // ⭐ Correct output field for your account
            var text = result.text || "No response generated.";

            var form = ui.createForm({ title: 'AI Response' });
            form.addField({
                id: 'custpage_output',
                type: ui.FieldType.LONGTEXT,
                label: 'Response'
            }).defaultValue = text;

            form.addButton({
                id: 'custpage_back',
                label: 'Back',
                functionName: "history.go(-1)"
            });

            context.response.writePage(form);

        } catch (error) {
            log.error('ERROR 2', error);
        }
    }

    return { onRequest: onRequest };
});
