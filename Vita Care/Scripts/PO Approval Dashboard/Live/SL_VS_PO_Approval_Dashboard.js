/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @Filename SL || PO Approval Dashboard
 * @Description Purchase Order Approval Dashboard (Workflow-driven, HTML frontend)
 *
 * ====================================================================
 * WORKFLOW OVERVIEW
 * Workflow Script ID : customworkflow_vs_po_approval
 * Key Field          : custbody_vc_curr_role  ("Next/Current Approver Roles")
 *
 * The workflow sets custbody_vc_curr_role to indicate WHO should act next:
 *   • For ROLE-based states  → stores the role name string (e.g. 'VC - BD')
 *   • For USER-based states  → stores the user's internal ID as a string
 *   • EMPTY + approvalstatus = 1  → Initial State, any user may act
 *
 * ====================================================================
 * BRANCH ROUTING OVERVIEW  (determined by Amount + Months)
 * ====================================================================
 *
 *  Amount <= 50,000
 *    └─ BRANCH A : BD Manager only → Approved
 *
 *  Amount < 500,000  AND  Months > 2  AND  Months <= 3
 *    └─ BRANCH B : BD Manager → S & OP → Approved
 *                                      └─ S & OP Reject (BD Mgr group)
 *
 *  Amount < 500,000  AND  Months > 3
 *    └─ BRANCH C : BD Manager → Commercial Director → Approved
 *                                                   └─ Comm Dir Reject (BD Mgr group)
 *
 *  Amount >= 500,000  AND  Amount < 1,000,000
 *    └─ BRANCH D : BD Manager → Commercial Director → CFO → Approved
 *                                                   └─ Comm Dir Reject (BD Mgr group)
 *                                         └─ CFO Reject (Comm Dir) → CFO again
 *
 *  Amount >= 1,000,000
 *    └─ BRANCH E : BD Manager → Commercial Director → F&A Director (CFO) → CEO → Approved
 *                                                   └─ Comm Dir Reject (BD Mgr group)
 *                                   └─ F&A Reject (Comm Dir) → F&A again
 *                                                 └─ CEO Reject (F&A) → CEO again
 *                                                             └─ F&A Reject (Comm Dir) loop
 *
 *  NOTE: BD Manager (VC - BD) approval is MANDATORY at the start of every branch.
 *
 * ====================================================================
 * ROLE USED PER LEVEL
 * ====================================================================
 *  BD Manager              : VC - BD
 *  S & OP Approver         : user 413502  (user-ID stored, Branch B only)
 *  Commercial Director     : VC - Commercial Director
 *  CFO (Branch D)          : VC - CFO
 *  F&A Director (Branch E) : VC - F&A Director   ← different from Branch D CFO
 *  CEO (Branch E)          : VC - Chief Executive Officer
 *
 * ====================================================================
 * FULL STATE MAP
 * ====================================================================
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ INITIAL STATE  (workflowstate340)                               │
 * │  Condition : custbody_vc_curr_role IS EMPTY                     │
 * │              + approvalstatus = 1 (Pending Approval)            │
 * │  Access    : ALL users                                          │
 * │  Actions   :                                                    │
 * │    Submit for Approval → workflowaction1805                     │
 * │    Reject              → workflowaction2169                     │
 * │  After Submit → workflow routes to A/B/C/D/E by amount+months   │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ════════════ BRANCH A — Amount <= 50,000 ════════════
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ BD Manager Approval — BRANCH A  (state ID not provided)         │
 * │  SOLE and FINAL approver for amounts <= 50,000.                 │
 * │  Role field value : 'VC - BD'                                   │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1806  → APPROVED (state291)         │
 * │    Reject   → workflowaction1807                                │
 * │    Resubmit → workflowaction2028                                │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ════════════ BRANCH B — Amount < 500K, Months > 2, Months <= 3 ════════════
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ BD Manager Approval — BRANCH B  (workflowstate344)              │
 * │  Role field value : 'VC - BD'                                   │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1810  → S & OP Approval (state345)  │
 * │    Reject   → workflowaction1811                                │
 * │    Resubmit → workflowaction2030                                │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ S & OP Approval  (workflowstate345)                             │
 * │  Role field value : '413502'  ← user internal ID               │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1826  → APPROVED (state291)         │
 * │    Reject   → workflowaction1827  → S&OP Reject BD (state358)   │
 * │    Resubmit → workflowaction2031                                │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ S & OP Reject (BD Manager)  (workflowstate358)                  │
 * │  Role field value : TODO — confirm value set by workflow        │
 * │  Users : 146766, 454454, 421041, 425160                         │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1829                                │
 * │    Reject   → workflowaction1830                                │
 * │    Resubmit → workflowaction2029                                │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ════════════ BRANCH C — Amount < 500K, Months > 3 ════════════
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ BD Manager Approval — BRANCH C  (workflowstate347)              │
 * │  Role field value : 'VC - BD'                                   │
 * │  Users : 146766, 454454, 421041, 425160                         │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1814  → Comm Dir Appr (state348)    │
 * │    Reject   → workflowaction1815  → Initial (state340)          │
 * │    Resubmit → workflowaction2033  → Initial (state340)          │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Commercial Director Approval — BRANCH C  (workflowstate348)     │
 * │  Role field value : 'VC - Commercial Director'                  │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1833  → APPROVED (state291)         │
 * │    Reject   → workflowaction1834  → Comm Dir Rej C (state359)   │
 * │    Resubmit → workflowaction2032                                │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Comm Dir Reject (BD Manager) — BRANCH C  (workflowstate359)     │
 * │  Role field value : TODO — confirm value set by workflow        │
 * │  Users : 146766, 454454, 421041, 425160                         │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1857  → Comm Dir Appr (state348)    │
 * │    Reject   → workflowaction1858  → Initial (state340)          │
 * │    Resubmit → workflowaction2032  → Initial (state340)          │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ════════════ BRANCH D — Amount >= 500K AND Amount < 1M ════════════
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ BD Manager Approval — BRANCH D  (workflowstate350)              │
 * │  Role field value : 'VC - BD'                                   │
 * │  Users : 146766, 454454, 421041, 425160                         │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1818  → Comm Dir Appr (state351)    │
 * │    Reject   → workflowaction1819  → Initial (state340)          │
 * │    Resubmit → workflowaction2037  → Initial (state340)          │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Commercial Director Approval — BRANCH D  (workflowstate351)     │
 * │  Role field value : 'VC - Commercial Director'                  │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1837  → CFO Approval (state352)     │
 * │    Reject   → workflowaction1838  → Comm Dir Rej D (state360)   │
 * │    Resubmit → workflowaction2038                                │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Comm Dir Reject (BD Manager) — BRANCH D  (workflowstate360)     │
 * │  Role field value : TODO — confirm value set by workflow        │
 * │  Users : 146766, 454454, 421041, 425160                         │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1861  → Comm Dir Appr (state351)    │
 * │    Reject   → workflowaction1862  → Initial (state340)          │
 * │    Resubmit → workflowaction2035  → Initial (state340)          │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ CFO Approval  (workflowstate352)  Role : VC - CFO               │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1849  → APPROVED (state291)         │
 * │    Reject   → workflowaction1850  → CFO Reject D (state361)     │
 * │    Resubmit → workflowaction2039                                │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ CFO Reject (Commercial Director)  (workflowstate361)            │
 * │  Role field value : 'VC - Commercial Director'                  │
 * │  NOTE: Distinct from state351 via ROLE_FIELD.CFO_REJECT_COMM_DIR│
 * │  TODO: Confirm exact field value the workflow sets here         │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1865  → CFO Approval (state352)     │
 * │    Reject   → workflowaction1866  → Comm Dir Rej D (state360)   │
 * │    Resubmit → workflowaction2036  → Initial (state340)          │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ════════════ BRANCH E — Amount >= 1,000,000 ════════════
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ BD Manager Approval — BRANCH E  (workflowstate354)              │
 * │  Role field value : 'VC - BD'                                   │
 * │  Users : 146766, 454454, 421041, 425160                         │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1822  → Comm Dir Appr (state355)    │
 * │    Reject   → workflowaction1823  → Initial (state340)          │
 * │    Resubmit → workflowaction2043  → Initial (state340)          │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Commercial Director Approval — BRANCH E  (workflowstate355)     │
 * │  Role field value : 'VC - Commercial Director'                  │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1841  → F&A Approval (state356)     │
 * │    Reject   → workflowaction1842  → Comm Dir Rej E (state362)   │
 * │    Resubmit → workflowaction2041  → Initial (state340)          │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Comm Dir Reject (BD Manager) — BRANCH E  (workflowstate362)     │
 * │  Role field value : TODO — confirm value set by workflow        │
 * │  Users : 146766, 454454, 421041, 425160                         │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1869  → Comm Dir Appr (state355)    │
 * │    Reject   → workflowaction1870  → Initial (state340)          │
 * │    Resubmit → workflowaction2040  → Initial (state340)          │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ F&A Director Approval  (workflowstate356)                       │
 * │  Role field value : 'VC - F&A Director'                         │
 * │  NOTE: This is a DIFFERENT role from Branch D's 'VC - CFO'      │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1853  → CEO Approval (state357)     │
 * │    Reject   → workflowaction1854  → F&A Reject (state363)       │
 * │    Resubmit → workflowaction2045                                │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ F&A Reject (Commercial Director)  (workflowstate363)            │
 * │  Role field value : 'VC - Commercial Director'                  │
 * │  NOTE: Distinct from state355 via ROLE_FIELD.FA_REJECT_COMM_DIR │
 * │  TODO: Confirm exact field value the workflow sets here         │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1873  → F&A Approval (state356)     │
 * │    Reject   → workflowaction1874  → Comm Dir Rej E (state362)   │
 * │    Resubmit → workflowaction2044  → Initial (state340)          │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ CEO Approval  (workflowstate357)                                │
 * │  Role field value : 'VC - Chief Executive Officer'              │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1845  → APPROVED (state291)         │
 * │    Reject   → workflowaction1846  → CEO Reject (state364)       │
 * │    Resubmit → workflowaction2046  → Initial (state340)          │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ CEO Reject (F&A Director)  (workflowstate364)                   │
 * │  Role field value : 'VC - F&A Director'                         │
 * │  NOTE: Distinct from state356 via ROLE_FIELD.CEO_REJECT_FA      │
 * │  TODO: Confirm exact field value the workflow sets here         │
 * │  Actions   :                                                    │
 * │    Approve  → workflowaction1877  → CEO Approval (state357)     │
 * │    Reject   → workflowaction1878  → F&A Reject (state363)       │
 * │    Resubmit → workflowaction2042  → Initial (state340)          │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ FINAL STATE — APPROVED  (workflowstate291)                      │
 * │  PO is fully approved. No further actions required.             │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ====================================================================
 * DISAMBIGUATION SUMMARY FOR SHARED ROLE FIELD VALUES
 * ====================================================================
 *  'VC - BD'
 *      amount <= 50K            → Branch A  (no state ID)
 *      amount < 500K, months<=3 → Branch B  (state344)
 *      amount < 500K, months>3  → Branch C  (state347)
 *      amount >= 500K < 1M      → Branch D  (state350)
 *      amount >= 1M             → Branch E  (state354)
 *
 *  'VC - Commercial Director'
 *      amount < 500K            → Comm Dir Approval Branch C  (state348)
 *      amount >= 500K < 1M      → Comm Dir Approval Branch D  (state351)
 *      amount >= 1M             → Comm Dir Approval Branch E  (state355)
 *      + CFO_REJECT_COMM_DIR    → CFO Reject Branch D         (state361)
 *      + FA_REJECT_COMM_DIR     → F&A Reject Branch E         (state363)
 *
 *  'VC - F&A Director'
 *      (no overlap by amount; always Branch E)
 *      + CEO_REJECT_FA          → CEO Reject Branch E         (state364)
 *      without marker           → F&A Approval Branch E       (state356)
 *
 *  'VC - Chief Executive Officer'
 *      (no overlap; always Branch E, state357)
 *
 *  BD_MGR_USER_IDS  (146766, 454454, 421041, 425160)
 *      amount < 500K, months<=3 → S&OP Reject Branch B        (state358)
 *      amount < 500K, months>3  → Comm Dir Reject Branch C    (state359)
 *      amount >= 500K < 1M      → Comm Dir Reject Branch D    (state360)
 *      amount >= 1M             → Comm Dir Reject Branch E    (state362)
 *
 * ====================================================================
 */

define(['N/file', 'N/runtime', 'N/search', 'N/record', 'N/workflow', 'N/log', 'N/url'], (file, runtime, search, record, workflow, log, url) => {

    /* =====================================================
     * WORKFLOW CONFIGURATION
     * ===================================================== */
    const WORKFLOW_ID = 'customworkflow_vs_po_approval';

    /**
     * Custom field storing the number of months on the PO.
     * Used to distinguish Branch B (Months <= 3) from Branch C (Months > 3)
     * when amount < 500,000.
     * TODO: Confirm correct field ID.
     */
    const PO_MONTHS_FIELD_ID = 'custbody_vs_months'; // ← TODO: confirm

    /* =====================================================
     * WORKFLOW STATE IDs
     * For documentation and log traceability only.
     * NOT passed to workflow.trigger() — only action IDs are.
     * ===================================================== */
    const WORKFLOW_STATES = {
        INITIAL: 'workflowstate340',
        // ── Branch B ──────────────────────────────────────
        BD_MGR_BRANCH_B: 'workflowstate344',
        SOP_APPROVAL: 'workflowstate345',
        SOP_REJECT_BD_MGR: 'workflowstate358',
        // ── Branch C ──────────────────────────────────────
        BD_MGR_BRANCH_C: 'workflowstate347',
        COMM_DIR_BRANCH_C: 'workflowstate348',
        COMM_DIR_REJECT_C: 'workflowstate359',
        // ── Branch D ──────────────────────────────────────
        BD_MGR_BRANCH_D: 'workflowstate350',
        COMM_DIR_BRANCH_D: 'workflowstate351',
        COMM_DIR_REJECT_D: 'workflowstate360',
        CFO_APPROVAL: 'workflowstate352',
        CFO_REJECT: 'workflowstate361',
        // ── Branch E ──────────────────────────────────────
        BD_MGR_BRANCH_E: 'workflowstate354',
        COMM_DIR_BRANCH_E: 'workflowstate355',
        COMM_DIR_REJECT_E: 'workflowstate362',
        FA_APPROVAL: 'workflowstate356',  // F&A Director (≥ 1M, distinct from VC - CFO)
        FA_REJECT: 'workflowstate363',  // F&A Reject → back to Comm Dir
        CEO_APPROVAL: 'workflowstate357',
        CEO_REJECT: 'workflowstate364',  // CEO Reject → back to F&A Director
        // ── Final ─────────────────────────────────────────
        APPROVED: 'workflowstate291'
        // Branch A BD Manager state ID was not provided by client
    };

    /* =====================================================
     * WORKFLOW ACTION IDs  —  grouped by state
     * ===================================================== */
    const ACTIONS = {

        /**
         * INITIAL STATE  (workflowstate340)
         * Role field : EMPTY.  All users can act.
         * Button label for "approve" should read "Submit for Approval".
         */
        INITIAL: {
            SUBMIT_FOR_APPROVAL: 'workflowaction1805',
            REJECT: 'workflowaction2169'
        },

        /**
         * BD Manager Approval — BRANCH A  (Amount <= 50,000)
         * SOLE and FINAL approver for this amount range.
         * Role field : 'VC - BD'
         * State ID   : not provided
         */
        BD_MGR_BRANCH_A: {
            APPROVE: 'workflowaction1806',
            REJECT: 'workflowaction1807',
            RESUBMIT: 'workflowaction2028'
        },

        /**
         * BD Manager Approval — BRANCH B  (Amount < 500K, Months > 2 and <= 3)
         * After Approve → S & OP Approval (workflowstate345)
         * State ID : workflowstate344
         * Role field : 'VC - BD'
         */
        BD_MGR_BRANCH_B: {
            APPROVE: 'workflowaction1810',
            REJECT: 'workflowaction1811',
            RESUBMIT: 'workflowaction2030'
        },

        /**
         * S & OP Approval  (workflowstate345) — BRANCH B only
         * After Approve → APPROVED (state291)
         * After Reject  → S & OP Reject BD Manager (state358)
         * Role field : '413502'  (user internal ID stored as string)
         */
        SOP_APPROVAL: {
            APPROVE: 'workflowaction1826',
            REJECT: 'workflowaction1827',
            RESUBMIT: 'workflowaction2031'
        },

        /**
         * S & OP Reject (BD Manager)  (workflowstate358) — BRANCH B only
         * Reached when S & OP user rejects.
         * Role field : TODO — confirm value set by workflow
         * Users : 146766, 454454, 421041, 425160
         */
        SOP_REJECT_BD_MGR: {
            APPROVE: 'workflowaction1829',
            REJECT: 'workflowaction1830',
            RESUBMIT: 'workflowaction2029'
        },

        /**
         * BD Manager Approval — BRANCH C  (Amount < 500K, Months > 3)
         * After Approve  → Commercial Director Approval (state348)
         * After Reject   → Initial (state340)
         * After Resubmit → Initial (state340)
         * State ID   : workflowstate347
         * Role field : 'VC - BD'
         * Users : 146766, 454454, 421041, 425160
         */
        BD_MGR_BRANCH_C: {
            APPROVE: 'workflowaction1814',
            REJECT: 'workflowaction1815',
            RESUBMIT: 'workflowaction2033'
        },

        /**
         * Commercial Director Approval — BRANCH C  (workflowstate348)
         * After Approve → APPROVED (state291)
         * After Reject  → Comm Dir Reject BD Manager (state359)
         * Role field : 'VC - Commercial Director'
         */
        COMM_DIR_BRANCH_C: {
            APPROVE: 'workflowaction1833',
            REJECT: 'workflowaction1834',
            RESUBMIT: 'workflowaction2032'
        },

        /**
         * Comm Dir Reject (BD Manager) — BRANCH C  (workflowstate359)
         * After Approve  → Commercial Director Approval (state348)
         * After Reject   → Initial (state340)
         * After Resubmit → Initial (state340)
         * Role field : TODO — confirm value set by workflow
         * Users : 146766, 454454, 421041, 425160
         */
        COMM_DIR_REJECT_C: {
            APPROVE: 'workflowaction1857',
            REJECT: 'workflowaction1858',
            RESUBMIT: 'workflowaction2032'
        },

        /**
         * BD Manager Approval — BRANCH D  (Amount >= 500K AND < 1M)
         * After Approve  → Commercial Director Approval (state351)
         * After Reject   → Initial (state340)
         * After Resubmit → Initial (state340)
         * State ID   : workflowstate350
         * Role field : 'VC - BD'
         * Users : 146766, 454454, 421041, 425160
         */
        BD_MGR_BRANCH_D: {
            APPROVE: 'workflowaction1818',
            REJECT: 'workflowaction1819',
            RESUBMIT: 'workflowaction2037'
        },

        /**
         * Commercial Director Approval — BRANCH D  (workflowstate351)
         * After Approve → CFO Approval (state352)
         * After Reject  → Comm Dir Reject BD Manager D (state360)
         * Role field : 'VC - Commercial Director'
         */
        COMM_DIR_BRANCH_D: {
            APPROVE: 'workflowaction1837',
            REJECT: 'workflowaction1838',
            RESUBMIT: 'workflowaction2038'
        },

        /**
         * Comm Dir Reject (BD Manager) — BRANCH D  (workflowstate360)
         * After Approve  → Commercial Director Approval (state351)
         * After Reject   → Initial (state340)
         * After Resubmit → Initial (state340)
         * Role field : TODO — confirm value set by workflow
         * Users : 146766, 454454, 421041, 425160
         */
        COMM_DIR_REJECT_D: {
            APPROVE: 'workflowaction1861',
            REJECT: 'workflowaction1862',
            RESUBMIT: 'workflowaction2035'
        },

        /**
         * CFO Approval  (workflowstate352) — BRANCH D only
         * Role : 'VC - CFO'  ← distinct from Branch E's F&A Director role
         * After Approve → APPROVED (state291)
         * After Reject  → CFO Reject (state361)
         */
        CFO_APPROVAL: {
            APPROVE: 'workflowaction1849',
            REJECT: 'workflowaction1850',
            RESUBMIT: 'workflowaction2039'
        },

        /**
         * CFO Reject (Commercial Director)  (workflowstate361) — BRANCH D only
         * Reached when CFO rejects. Returns to Comm Director for re-review.
         * After Approve  → CFO Approval (state352)
         * After Reject   → Comm Dir Reject BD Mgr D (state360)
         * After Resubmit → Initial (state340)
         * Role field : 'VC - Commercial Director'
         * DISAMBIGUATION: Both state351 and state361 share 'VC - Commercial Director'.
         * Resolved via ROLE_FIELD.CFO_REJECT_COMM_DIR marker. TODO: confirm with workflow.
         */
        CFO_REJECT: {
            APPROVE: 'workflowaction1865',
            REJECT: 'workflowaction1866',
            RESUBMIT: 'workflowaction2036'
        },

        /**
         * BD Manager Approval — BRANCH E  (Amount >= 1,000,000)
         * After Approve  → Commercial Director Approval (state355)
         * After Reject   → Initial (state340)
         * After Resubmit → Initial (state340)
         * State ID   : workflowstate354
         * Role field : 'VC - BD'
         * Users : 146766, 454454, 421041, 425160
         */
        BD_MGR_BRANCH_E: {
            APPROVE: 'workflowaction1822',
            REJECT: 'workflowaction1823',
            RESUBMIT: 'workflowaction2043'
        },

        /**
         * Commercial Director Approval — BRANCH E  (workflowstate355)
         * After Approve  → F&A Director Approval (state356)
         * After Reject   → Comm Dir Reject BD Manager E (state362)
         * After Resubmit → Initial (state340)
         * Role field : 'VC - Commercial Director'
         */
        COMM_DIR_BRANCH_E: {
            APPROVE: 'workflowaction1841',
            REJECT: 'workflowaction1842',
            RESUBMIT: 'workflowaction2041'
        },

        /**
         * Comm Dir Reject (BD Manager) — BRANCH E  (workflowstate362)
         * After Approve  → Commercial Director Approval (state355)
         * After Reject   → Initial (state340)
         * After Resubmit → Initial (state340)
         * Role field : TODO — confirm value set by workflow
         * Users : 146766, 454454, 421041, 425160
         */
        COMM_DIR_REJECT_E: {
            APPROVE: 'workflowaction1869',
            REJECT: 'workflowaction1870',
            RESUBMIT: 'workflowaction2040'
        },

        /**
         * F&A Director Approval  (workflowstate356) — BRANCH E only
         * Role : 'VC - F&A Director'  ← DIFFERENT from Branch D's 'VC - CFO'
         * After Approve → CEO Approval (state357)
         * After Reject  → F&A Reject → Comm Dir (state363)
         * After Resubmit → Initial (state340)  (not explicitly stated; assumed)
         */
        FA_APPROVAL: {
            APPROVE: 'workflowaction1853',
            REJECT: 'workflowaction1854',
            RESUBMIT: 'workflowaction2045'
        },

        /**
         * F&A Reject (Commercial Director)  (workflowstate363) — BRANCH E only
         * Reached when F&A Director rejects. Returns to Comm Director.
         * After Approve  → F&A Director Approval (state356)
         * After Reject   → Comm Dir Reject BD Mgr E (state362)
         * After Resubmit → Initial (state340)
         * Role field : 'VC - Commercial Director'
         * DISAMBIGUATION: Both state355 and state363 share 'VC - Commercial Director'
         * and amount >= 1M. Resolved via ROLE_FIELD.FA_REJECT_COMM_DIR marker.
         * TODO: Confirm exact value with workflow config.
         */
        FA_REJECT: {
            APPROVE: 'workflowaction1873',
            REJECT: 'workflowaction1874',
            RESUBMIT: 'workflowaction2041'
        },

        /**
         * CEO Approval  (workflowstate357) — BRANCH E only
         * Role : 'VC - Chief Executive Officer'
         * After Approve  → APPROVED (state291)
         * After Reject   → CEO Reject → F&A (state364)
         * After Resubmit → Initial (state340)
         */
        CEO_APPROVAL: {
            APPROVE: 'workflowaction1845',
            REJECT: 'workflowaction1846',
            RESUBMIT: 'workflowaction2046'
        },

        /**
         * CEO Reject (F&A Director)  (workflowstate364) — BRANCH E only
         * Reached when CEO rejects. Returns to F&A Director for re-review.
         * After Approve  → CEO Approval (state357)
         * After Reject   → F&A Reject → Comm Dir (state363)
         * After Resubmit → Initial (state340)
         * Role field : 'VC - F&A Director'
         * DISAMBIGUATION: Both state356 and state364 share 'VC - F&A Director'.
         * Resolved via ROLE_FIELD.CEO_REJECT_FA marker.
         * TODO: Confirm exact value with workflow config.
         */
        CEO_REJECT: {
            APPROVE: 'workflowaction1877',
            REJECT: 'workflowaction1878',
            RESUBMIT: 'workflowaction2042'
        }
    };

    /* =====================================================
     * ROLE → WORKFLOW ROLE NAME MAP
     * Maps NetSuite role scriptId → string stored in custbody_vc_curr_role.
     * TODO: Replace ALL placeholder keys with confirmed script IDs.
     * ===================================================== */
    const ROLE_TO_WORKFLOW_NAME = {
        'customrole_vc_bd_manager': 'VC - BD',                       // TODO: confirm
        'customrole_vc_commercial_director': 'VC - Commercial Director',       // TODO: confirm
        'customrole_vc_cfo': 'VC - CFO',                       // TODO: confirm (Branch D only)
        'customrole_vc_fa_director': 'VC - F&A Director',              // TODO: confirm (Branch E only)
        'customrole_vc_ceo': 'VC - Chief Executive Officer'    // TODO: confirm (Branch E only)
    };

    /* =====================================================
     * USER-BASED APPROVER LISTS
     * ===================================================== */

    /**
     * S & OP Approval (workflowstate345) — Branch B only.
     * Single user; workflow stores this user's ID in the role field.
     */
    const SOP_APPROVER_USER_IDS = [413502];

    /**
     * BD Manager user group — shared across ALL user-based states:
     *   state358 — S & OP Reject (BD Manager)            — Branch B
     *   state347 — BD Manager Approval                   — Branch C (role-based, handled via 'VC - BD')
     *   state359 — Comm Dir Reject (BD Manager)           — Branch C
     *   state350 — BD Manager Approval                   — Branch D (role-based, handled via 'VC - BD')
     *   state360 — Comm Dir Reject (BD Manager)           — Branch D
     *   state354 — BD Manager Approval                   — Branch E (role-based, handled via 'VC - BD')
     *   state362 — Comm Dir Reject (BD Manager)           — Branch E
     *
     * Amount + months are used to identify which specific state a PO is in.
     */
    const BD_MGR_USER_IDS = [146766, 454454, 421041, 425160];

    /* =====================================================
     * ROLE FIELD VALUE CONSTANTS
     * The exact strings the workflow writes into custbody_vc_curr_role.
     *
     * PLACEHOLDER entries (marked TODO) must be confirmed with the
     * workflow configuration before going live.
     * ===================================================== */
    const ROLE_FIELD = {
        BD_MANAGER: 'VC - BD',
        SOP_APPROVER: '413502',                    // state345, Branch B (user ID as string)
        COMM_DIRECTOR: 'VC - Commercial Director',
        CFO: 'VC - CFO',                  // state352/361, Branch D only
        FA_DIRECTOR: 'VC - F&A Director',         // state356/364, Branch E only — DIFFERENT from CFO
        CEO: 'VC - Chief Executive Officer', // state357, Branch E only

        /**
         * Disambiguation markers for states where the same role name
         * appears in both an approval state and a "reject/review" state.
         *
         * CFO_REJECT_COMM_DIR : workflowstate361 (Branch D — CFO rejects → Comm Dir)
         *   Both state351 and state361 use 'VC - Commercial Director'.
         *   Amount is >= 500K < 1M for both.
         *   TODO: Confirm what the workflow writes in custbody_vc_curr_role for state361.
         */
        CFO_REJECT_COMM_DIR: 'VC - CFO Reject CD',  // PLACEHOLDER — confirm

        /**
         * FA_REJECT_COMM_DIR  : workflowstate363 (Branch E — F&A rejects → Comm Dir)
         *   Both state355 and state363 use 'VC - Commercial Director'.
         *   Amount is >= 1M for both.
         *   TODO: Confirm what the workflow writes in custbody_vc_curr_role for state363.
         */
        FA_REJECT_COMM_DIR: 'VC - FA Reject CD',   // PLACEHOLDER — confirm

        /**
         * CEO_REJECT_FA       : workflowstate364 (Branch E — CEO rejects → F&A)
         *   Both state356 and state364 use 'VC - F&A Director'.
         *   Amount is >= 1M for both.
         *   TODO: Confirm what the workflow writes in custbody_vc_curr_role for state364.
         */
        CEO_REJECT_FA: 'VC - CEO Reject FA'   // PLACEHOLDER — confirm
    };

    /* =====================================================
     * AMOUNT THRESHOLDS  —  centralised for easy updates
     * ===================================================== */
    const AMOUNT = {
        BRANCH_A_MAX: 50000,     // Branch A  : Amount <= 50,000
        BRANCH_BCD_MAX: 500000,    // B/C split from D/E
        BRANCH_D_MAX: 1000000    // Branch D  : Amount < 1,000,000 (Branch E starts here)
    };

    /**
     * Month thresholds for Branch B vs Branch C (Amount < 500K only).
     *   Branch B : Months > 2 AND Months <= 3
     *   Branch C : Months > 3
     */
    const MONTHS = {
        BRANCH_B_MIN: 2, // exclusive lower bound
        BRANCH_B_MAX: 3, // inclusive upper bound
        BRANCH_C_MIN: 3  // exclusive lower bound for C
    };


    /* =====================================================
     * ENTRY POINT
     * ===================================================== */
    function onRequest(context) {
        try {
            if (context.request.method === 'GET') {
                serveHtml(context);
            } else {
                handlePost(context);
            }
        } catch (e) {
            log.error({ title: 'onRequest | Unhandled Error', details: e });
            context.response.write(JSON.stringify({ success: false, message: e.message }));
        }
    }

    /* =====================================================
     * GET → SERVE HTML
     * ===================================================== */
    function serveHtml(context) {
        const htmlFile = file.load({ id: 'SuiteScripts/POApproval/po_approval.html' });
        var htmlContent = htmlFile.getContents();
        const cssFile = file.load({ id: 'SuiteScripts/POApproval/po_approval.css' });
        htmlContent = htmlContent.replace(
            '<link rel="stylesheet" href="po_approval.css">',
            '<link rel="stylesheet" href="' + cssFile.url + '">'
        );
        context.response.write(htmlContent);
    }

    /* =====================================================
     * POST ROUTER
     * ===================================================== */
    function handlePost(context) {
        const body = JSON.parse(context.request.body || '{}');
        log.debug({ title: 'handlePost | Action', details: body.action });
        let result;

        switch (body.action) {
            case 'getData': result = getPurchaseOrders(body); break;
            case 'getVendors': result = getVendors(); break;
            case 'getLocations': result = getLocations(); break;
            case 'getSubsidiaries': result = getSubsidiaries(); break;
            case 'approve': result = approvePurchaseOrders(body.ids || []); break;
            case 'reject': result = rejectPurchaseOrders(body.ids || []); break;
            case 'resubmit': result = resubmitPurchaseOrders(body.ids || []); break;
            case 'view_record':
                context.response.write(JSON.stringify({
                    url: url.resolveRecord({
                        recordType: 'purchaseorder',
                        recordId: body.id,
                        isEditMode: false
                    })
                }));
                return;
            default:
                result = { success: false, message: 'Invalid action: ' + body.action };
        }

        context.response.write(JSON.stringify(result));
    }

    /* =====================================================
     * GET CURRENT USER CONTEXT
     *
     * Flags built from the logged-in user's role + ID:
     *   isAdmin         — role 3; sees all records, triggers all actions
     *   isBdManagerRole — role = VC - BD  (role-based BD Mgr states)
     *   isBdManagerUser — user ID in BD_MGR_USER_IDS  (user-based BD/reject states)
     *   isSopApprover   — user 413502  (state345, Branch B only)
     *   isCommDirector  — role = VC - Commercial Director  (states 348/351/355/359/360/361/362/363)
     *   isCfo           — role = VC - CFO  (states 352/361, Branch D only)
     *   isFaDirector    — role = VC - F&A Director  (states 356/364, Branch E only)
     *   isCeo           — role = VC - Chief Executive Officer  (states 357/364, Branch E only)
     * ===================================================== */
    function getUserContext() {
        const user = runtime.getCurrentUser();
        log.debug({
            title: 'getUserContext | Raw User',
            details: { id: user.id, role: user.role, roleId: user.roleId, name: user.name }
        });

        const isAdmin = (user.role === 3);
        const workflowRoleName = ROLE_TO_WORKFLOW_NAME[user.roleId] || null;

        const ctx = {
            id: user.id,
            roleId: user.roleId,
            workflowRoleName: workflowRoleName,
            isAdmin: isAdmin,
            isBdManagerRole: (workflowRoleName === ROLE_FIELD.BD_MANAGER),
            isBdManagerUser: BD_MGR_USER_IDS.includes(user.id),
            isSopApprover: SOP_APPROVER_USER_IDS.includes(user.id),
            isCommDirector: (workflowRoleName === ROLE_FIELD.COMM_DIRECTOR),
            isCfo: (workflowRoleName === ROLE_FIELD.CFO),
            isFaDirector: (workflowRoleName === ROLE_FIELD.FA_DIRECTOR),
            isCeo: (workflowRoleName === ROLE_FIELD.CEO),
            canActOnInitial: true
        };

        log.debug({ title: 'getUserContext | Context', details: ctx });
        return ctx;
    }

    /* =====================================================
     * GET PURCHASE ORDERS
     * ===================================================== */
    function getPurchaseOrders(params) {
        const ctx = getUserContext();

        const filters = [
            ['type', 'anyof', 'PurchOrd'],
            'AND',
            ['mainline', 'is', 'T'],
            'AND',
            ['approvalstatus', 'anyof', '1']   // 1 = Pending Approval
        ];

        if (!ctx.isAdmin) {
            const visFilter = buildVisibilityFilter(ctx);
            if (!visFilter) {
                log.debug({ title: 'getPurchaseOrders | No visibility — returning empty', details: ctx });
                return { success: true, data: [] };
            }
            filters.push('AND', visFilter);
        }

        if (params.fromDate) filters.push('AND', ['trandate', 'onorafter', formatDateToDDMMYYYY(params.fromDate)]);
        if (params.toDate) filters.push('AND', ['trandate', 'onorbefore', formatDateToDDMMYYYY(params.toDate)]);
        if (params.vendorId) filters.push('AND', ['entity', 'anyof', params.vendorId]);
        if (params.locationId) filters.push('AND', ['location', 'anyof', params.locationId]);
        if (params.subsidiaryId) filters.push('AND', ['subsidiary', 'anyof', params.subsidiaryId]);

        log.debug({ title: 'getPurchaseOrders | Filters', details: JSON.stringify(filters) });

        const results = [];

        const poSearch = search.create({
            type: 'purchaseorder',
            settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
            filters: filters,
            columns: [
                search.createColumn({ name: 'tranid', label: 'Document Number' }),
                search.createColumn({ name: 'transactionname', label: 'Transaction Name' }),
                search.createColumn({ name: 'internalid', label: 'Internal ID' }),
                search.createColumn({ name: 'trandate', label: 'Date' }),
                search.createColumn({ name: 'mainname', label: 'Vendor' }),
                search.createColumn({ name: 'amount', label: 'Amount' }),
                search.createColumn({ name: 'custbody_vc_curr_role', label: 'Next/Current Approver Roles' })
            ]
        });

        poSearch.run().each(r => {
            const roleFieldValue = r.getValue('custbody_vc_curr_role') || '';
            const amount = parseFloat(r.getValue('amount')) || 0;
            results.push({
                id: r.id,
                documentNo: r.getValue('tranid'),
                transName: r.getValue('transactionname'),
                date: r.getValue('trandate'),
                vendor: r.getText('mainname'),
                amount: amount,
                roleFieldValue: roleFieldValue,
                approvalStage: resolveApprovalStageLabel(roleFieldValue, amount)
            });
            return true;
        });

        log.debug({ title: 'getPurchaseOrders | Row Count', details: results.length });
        return { success: true, data: results };
    }

    /* =====================================================
     * BUILD VISIBILITY FILTER
     * OR-filter so each user sees only their actionable records.
     *
     *  All users       → Initial (empty role field)
     *  BD Mgr role     → 'VC - BD'
     *  BD Mgr user     → user's own ID  (user-based reject/review states)
     *  SOP Approver    → '413502'
     *  Comm Director   → 'VC - Commercial Director' + reject-state markers
     *  CFO             → 'VC - CFO'  (Branch D)
     *  F&A Director    → 'VC - F&A Director' + CEO reject marker  (Branch E)
     *  CEO             → 'VC - Chief Executive Officer'  (Branch E)
     * ===================================================== */
    function buildVisibilityFilter(ctx) {
        const orParts = [
            ['custbody_vc_curr_role', 'isempty', ''] // Initial State — all users
        ];

        // BD Manager role-based (Branch A BD Mgr + Branches B/C/D/E BD Mgr approval states)
        if (ctx.isBdManagerRole) {
            orParts.push('OR', ['custbody_vc_curr_role', 'is', ROLE_FIELD.BD_MANAGER]);
        }

        // BD Manager user-based (reject/review states 358, 359, 360, 362)
        // Assumes workflow stores individual user ID. TODO: update if a shared marker is used.
        if (ctx.isBdManagerUser) {
            orParts.push('OR', ['custbody_vc_curr_role', 'is', String(ctx.id)]);
        }

        // S & OP Approver — user 413502 only (state345, Branch B)
        if (ctx.isSopApprover) {
            orParts.push('OR', ['custbody_vc_curr_role', 'is', ROLE_FIELD.SOP_APPROVER]);
        }

        // Commercial Director — states 348, 351, 355 (approval) + 361, 363 (reject markers)
        if (ctx.isCommDirector) {
            orParts.push('OR', ['custbody_vc_curr_role', 'is', ROLE_FIELD.COMM_DIRECTOR]);
            orParts.push('OR', ['custbody_vc_curr_role', 'is', ROLE_FIELD.CFO_REJECT_COMM_DIR]);  // state361
            orParts.push('OR', ['custbody_vc_curr_role', 'is', ROLE_FIELD.FA_REJECT_COMM_DIR]);   // state363
        }

        // CFO — state352 + state361 (Branch D only)
        if (ctx.isCfo) {
            orParts.push('OR', ['custbody_vc_curr_role', 'is', ROLE_FIELD.CFO]);
        }

        // F&A Director — state356 (approval) + state364 (CEO reject marker)  (Branch E only)
        if (ctx.isFaDirector) {
            orParts.push('OR', ['custbody_vc_curr_role', 'is', ROLE_FIELD.FA_DIRECTOR]);
            orParts.push('OR', ['custbody_vc_curr_role', 'is', ROLE_FIELD.CEO_REJECT_FA]);        // state364
        }

        // CEO — state357 (Branch E only)
        if (ctx.isCeo) {
            orParts.push('OR', ['custbody_vc_curr_role', 'is', ROLE_FIELD.CEO]);
        }

        return orParts;
    }

    /* =====================================================
     * RESOLVE APPROVAL STAGE LABEL
     * Human-readable badge text for each table row.
     *
     * NOTE: Months are NOT a search column, so Branch B and C
     * are merged when amount < 500K for display purposes.
     * The exact branch is resolved at action-trigger time
     * by resolvePoActions() which loads the full record.
     * ===================================================== */
    function resolveApprovalStageLabel(roleFieldValue, amount) {

        if (!roleFieldValue) return 'Initial — Pending Submission';

        /* ── BD Manager role-based (all branches) ── */
        if (roleFieldValue === ROLE_FIELD.BD_MANAGER) {
            if (amount <= AMOUNT.BRANCH_A_MAX) return 'BD Manager Approval (≤ 50K — Branch A)';
            if (amount < AMOUNT.BRANCH_BCD_MAX) return 'BD Manager Approval (< 500K — Branch B / C)';
            if (amount < AMOUNT.BRANCH_D_MAX) return 'BD Manager Approval (500K–1M — Branch D)';
            return 'BD Manager Approval (≥ 1M — Branch E)';
        }

        /* ── S & OP Approver (state345 — Branch B) ── */
        if (roleFieldValue === ROLE_FIELD.SOP_APPROVER) return 'S & OP Approval (Branch B)';

        /* ── Commercial Director disambiguation ──────────────────
         * Reject-state markers must be checked BEFORE the plain role
         * to avoid them matching ROLE_FIELD.COMM_DIRECTOR.           */
        if (roleFieldValue === ROLE_FIELD.CFO_REJECT_COMM_DIR) return 'CFO Reject → Comm Dir Review (Branch D)';
        if (roleFieldValue === ROLE_FIELD.FA_REJECT_COMM_DIR) return 'F&A Reject → Comm Dir Review (Branch E)';

        if (roleFieldValue === ROLE_FIELD.COMM_DIRECTOR) {
            if (amount < AMOUNT.BRANCH_BCD_MAX) return 'Commercial Director Approval (Branch C)';
            if (amount < AMOUNT.BRANCH_D_MAX) return 'Commercial Director Approval (Branch D)';
            return 'Commercial Director Approval (Branch E)';
        }

        /* ── CFO (Branch D only) ── */
        if (roleFieldValue === ROLE_FIELD.CFO) return 'CFO Approval (Branch D)';

        /* ── F&A Director disambiguation ─────────────────────────
         * CEO_REJECT_FA marker checked first.                       */
        if (roleFieldValue === ROLE_FIELD.CEO_REJECT_FA) return 'CEO Reject → F&A Director Review (Branch E)';
        if (roleFieldValue === ROLE_FIELD.FA_DIRECTOR) return 'F&A Director Approval (Branch E)';

        /* ── CEO (Branch E only) ── */
        if (roleFieldValue === ROLE_FIELD.CEO) return 'CEO Approval (Branch E)';

        /* ── User-based BD Manager states (reject/review groups) ── */
        if (BD_MGR_USER_IDS.map(String).includes(roleFieldValue)) {
            if (amount < AMOUNT.BRANCH_BCD_MAX) return 'BD Manager Review (< 500K — Branch B / C)';
            if (amount < AMOUNT.BRANCH_D_MAX) return 'BD Manager Review (500K–1M — Branch D)';
            return 'BD Manager Review (≥ 1M — Branch E)';
        }

        log.debug({ title: 'resolveApprovalStageLabel | Unknown roleFieldValue', details: roleFieldValue });
        return roleFieldValue; // Raw fallback for unknown / future states
    }

    /* =====================================================
     * RESOLVE PO ACTIONS
     * Loads the full PO record → reads roleFieldValue, amount, months
     * → returns the correct {stateLabel, approveLabel, approveAction,
     *   rejectAction, resubmitAction} or null if user cannot act.
     *
     * DISAMBIGUATION BLOCKS (in order):
     *
     *  1  roleFieldValue = ''                → Initial
     *  2  roleFieldValue = 'VC - BD'         → BD Manager role-based
     *       amount <= 50K                   → Branch A
     *       amount < 500K, months <= 3      → Branch B (state344)
     *       amount < 500K, months > 3       → Branch C (state347)
     *       amount >= 500K < 1M             → Branch D (state350)
     *       amount >= 1M                    → Branch E (state354)
     *  3  roleFieldValue in BD_MGR_USER_IDS  → BD Manager user-based
     *       amount < 500K, months <= 3      → S&OP Reject B (state358)
     *       amount < 500K, months > 3       → Comm Dir Reject C (state359)
     *       amount >= 500K < 1M             → Comm Dir Reject D (state360)
     *       amount >= 1M                    → Comm Dir Reject E (state362)
     *  4  roleFieldValue = '413502'          → S&OP Approval (state345, Branch B)
     *  5  roleFieldValue = CFO_REJECT_COMM_DIR → CFO Reject Comm Dir (state361, Branch D)
     *  6  roleFieldValue = FA_REJECT_COMM_DIR  → F&A Reject Comm Dir (state363, Branch E)
     *  7  roleFieldValue = 'VC - Commercial Director'
     *       amount < 500K                   → Comm Dir Approval Branch C (state348)
     *       amount >= 500K < 1M             → Comm Dir Approval Branch D (state351)
     *       amount >= 1M                    → Comm Dir Approval Branch E (state355)
     *  8  roleFieldValue = 'VC - CFO'        → CFO Approval (state352, Branch D)
     *  9  roleFieldValue = CEO_REJECT_FA     → CEO Reject F&A (state364, Branch E)
     * 10  roleFieldValue = 'VC - F&A Director' → F&A Approval (state356, Branch E)
     * 11  roleFieldValue = 'VC - Chief Executive Officer' → CEO Approval (state357, Branch E)
     * ===================================================== */
    function resolvePoActions(poId, userCtx) {
        const po = record.load({ type: 'purchaseorder', id: poId });
        const roleFieldValue = po.getValue('custbody_vc_curr_role') || '';
        const amount = parseFloat(po.getValue('amount')) || 0;
        const months = parseFloat(po.getValue(PO_MONTHS_FIELD_ID)) || 0;

        log.debug({
            title: 'resolvePoActions | Record State',
            details: { poId, roleFieldValue, amount, months, monthsField: PO_MONTHS_FIELD_ID }
        });

        /* ══ 1. INITIAL STATE ═══════════════════════════════════════ */
        if (!roleFieldValue) {
            return {
                stateLabel: 'Initial State (workflowstate340)',
                approveLabel: 'Submit for Approval',
                approveAction: ACTIONS.INITIAL.SUBMIT_FOR_APPROVAL,
                rejectAction: ACTIONS.INITIAL.REJECT,
                resubmitAction: null  // Resubmit not available from Initial State
            };
        }

        /* ══ 2. BD MANAGER — ROLE-BASED ═════════════════════════════
         * roleFieldValue = 'VC - BD'
         * Covers Branches A, B (state344), C (state347), D (state350), E (state354) */
        if (roleFieldValue === ROLE_FIELD.BD_MANAGER) {
            if (!userCtx.isAdmin && !userCtx.isBdManagerRole) {
                log.debug({ title: 'resolvePoActions | Not BD Manager role', details: { poId } });
                return null;
            }

            /* Branch A — Amount <= 50,000 — SOLE and FINAL approver */
            if (amount <= AMOUNT.BRANCH_A_MAX) {
                return {
                    stateLabel: 'BD Manager Approval — Branch A (≤ 50,000 — Final, no state ID)',
                    approveLabel: 'Approve',
                    approveAction: ACTIONS.BD_MGR_BRANCH_A.APPROVE,
                    rejectAction: ACTIONS.BD_MGR_BRANCH_A.REJECT,
                    resubmitAction: ACTIONS.BD_MGR_BRANCH_A.RESUBMIT
                };
            }

            /* Branches B & C — Amount < 500K — differentiate by months */
            if (amount < AMOUNT.BRANCH_BCD_MAX) {

                if (months > MONTHS.BRANCH_B_MIN && months <= MONTHS.BRANCH_B_MAX) {
                    /* Branch B — Months > 2 AND <= 3  (workflowstate344) */
                    return {
                        stateLabel: 'BD Manager Approval — Branch B (< 500K, Months 2–3, workflowstate344)',
                        approveLabel: 'Approve',
                        approveAction: ACTIONS.BD_MGR_BRANCH_B.APPROVE,
                        rejectAction: ACTIONS.BD_MGR_BRANCH_B.REJECT,
                        resubmitAction: ACTIONS.BD_MGR_BRANCH_B.RESUBMIT
                    };
                }

                if (months > MONTHS.BRANCH_C_MIN) {
                    /* Branch C — Months > 3  (workflowstate347)
                     * Reject/Resubmit → Initial (state340)              */
                    return {
                        stateLabel: 'BD Manager Approval — Branch C (< 500K, Months > 3, workflowstate347)',
                        approveLabel: 'Approve',
                        approveAction: ACTIONS.BD_MGR_BRANCH_C.APPROVE,
                        rejectAction: ACTIONS.BD_MGR_BRANCH_C.REJECT,
                        resubmitAction: ACTIONS.BD_MGR_BRANCH_C.RESUBMIT
                    };
                }

                /* Months field ambiguous — fallback to Branch B */
                log.warning({
                    title: 'resolvePoActions | Months ambiguous — defaulting to Branch B',
                    details: { poId, amount, months, PO_MONTHS_FIELD_ID }
                });
                return {
                    stateLabel: 'BD Manager Approval — Branch B/C FALLBACK (months field unclear)',
                    approveLabel: 'Approve',
                    approveAction: ACTIONS.BD_MGR_BRANCH_B.APPROVE,
                    rejectAction: ACTIONS.BD_MGR_BRANCH_B.REJECT,
                    resubmitAction: ACTIONS.BD_MGR_BRANCH_B.RESUBMIT
                };
            }

            /* Branch D — Amount >= 500K AND < 1M  (workflowstate350)
             * Reject/Resubmit → Initial (state340)                       */
            if (amount < AMOUNT.BRANCH_D_MAX) {
                return {
                    stateLabel: 'BD Manager Approval — Branch D (500K–1M, workflowstate350)',
                    approveLabel: 'Approve',
                    approveAction: ACTIONS.BD_MGR_BRANCH_D.APPROVE,
                    rejectAction: ACTIONS.BD_MGR_BRANCH_D.REJECT,
                    resubmitAction: ACTIONS.BD_MGR_BRANCH_D.RESUBMIT
                };
            }

            /* Branch E — Amount >= 1,000,000  (workflowstate354)
             * Reject/Resubmit → Initial (state340)                       */
            return {
                stateLabel: 'BD Manager Approval — Branch E (≥ 1M, workflowstate354)',
                approveLabel: 'Approve',
                approveAction: ACTIONS.BD_MGR_BRANCH_E.APPROVE,
                rejectAction: ACTIONS.BD_MGR_BRANCH_E.REJECT,
                resubmitAction: ACTIONS.BD_MGR_BRANCH_E.RESUBMIT
            };
        }

        /* ══ 3. BD MANAGER — USER-BASED ═════════════════════════════
         * Covers: state358 (Branch B SOP Reject),
         *         state359 (Branch C Comm Dir Reject),
         *         state360 (Branch D Comm Dir Reject),
         *         state362 (Branch E Comm Dir Reject)
         * Disambiguated by amount + months.                            */
        const isKnownBdMgrUser = BD_MGR_USER_IDS.map(String).includes(roleFieldValue);

        if (isKnownBdMgrUser) {
            if (!userCtx.isAdmin && !userCtx.isBdManagerUser) {
                log.debug({ title: 'resolvePoActions | Not BD Mgr user', details: { poId } });
                return null;
            }

            /* Branch B — S & OP Reject (BD Manager)  (workflowstate358)
             * Amount < 500K AND Months in B range                        */
            if (amount < AMOUNT.BRANCH_BCD_MAX &&
                months > MONTHS.BRANCH_B_MIN &&
                months <= MONTHS.BRANCH_B_MAX) {
                return {
                    stateLabel: 'S & OP Reject (BD Manager Review) — Branch B (workflowstate358)',
                    approveLabel: 'Approve',
                    approveAction: ACTIONS.SOP_REJECT_BD_MGR.APPROVE,
                    rejectAction: ACTIONS.SOP_REJECT_BD_MGR.REJECT,
                    resubmitAction: ACTIONS.SOP_REJECT_BD_MGR.RESUBMIT
                };
            }

            /* Branch C — Comm Dir Reject (BD Manager Review)  (workflowstate359)
             * Amount < 500K AND Months > 3
             * Approve → Comm Dir Approval (state348); Reject/Resubmit → Initial */
            if (amount < AMOUNT.BRANCH_BCD_MAX && months > MONTHS.BRANCH_C_MIN) {
                return {
                    stateLabel: 'Comm Dir Reject (BD Manager Review) — Branch C (workflowstate359)',
                    approveLabel: 'Approve',
                    approveAction: ACTIONS.COMM_DIR_REJECT_C.APPROVE,
                    rejectAction: ACTIONS.COMM_DIR_REJECT_C.REJECT,
                    resubmitAction: ACTIONS.COMM_DIR_REJECT_C.RESUBMIT
                };
            }

            /* Branch D — Comm Dir Reject (BD Manager Review)  (workflowstate360)
             * Amount >= 500K AND < 1M
             * Approve → Comm Dir Approval (state351); Reject/Resubmit → Initial */
            if (amount >= AMOUNT.BRANCH_BCD_MAX && amount < AMOUNT.BRANCH_D_MAX) {
                return {
                    stateLabel: 'Comm Dir Reject (BD Manager Review) — Branch D (workflowstate360)',
                    approveLabel: 'Approve',
                    approveAction: ACTIONS.COMM_DIR_REJECT_D.APPROVE,
                    rejectAction: ACTIONS.COMM_DIR_REJECT_D.REJECT,
                    resubmitAction: ACTIONS.COMM_DIR_REJECT_D.RESUBMIT
                };
            }

            /* Branch E — Comm Dir Reject (BD Manager Review)  (workflowstate362)
             * Amount >= 1M
             * Approve → Comm Dir Approval (state355); Reject/Resubmit → Initial */
            if (amount >= AMOUNT.BRANCH_D_MAX) {
                return {
                    stateLabel: 'Comm Dir Reject (BD Manager Review) — Branch E (workflowstate362)',
                    approveLabel: 'Approve',
                    approveAction: ACTIONS.COMM_DIR_REJECT_E.APPROVE,
                    rejectAction: ACTIONS.COMM_DIR_REJECT_E.REJECT,
                    resubmitAction: ACTIONS.COMM_DIR_REJECT_E.RESUBMIT
                };
            }

            /* Months ambiguous fallback for < 500K user-based state */
            if (amount < AMOUNT.BRANCH_BCD_MAX) {
                log.warning({
                    title: 'resolvePoActions | BD Mgr user-based — months ambiguous, defaulting to SOP Reject B',
                    details: { poId, amount, months }
                });
                return {
                    stateLabel: 'S & OP Reject — Branch B FALLBACK (months field unclear)',
                    approveLabel: 'Approve',
                    approveAction: ACTIONS.SOP_REJECT_BD_MGR.APPROVE,
                    rejectAction: ACTIONS.SOP_REJECT_BD_MGR.REJECT,
                    resubmitAction: ACTIONS.SOP_REJECT_BD_MGR.RESUBMIT
                };
            }

            return null;
        }

        /* ══ 4. S & OP APPROVAL  (workflowstate345 — Branch B) ══════
         * Approve → APPROVED; Reject → S&OP Reject BD Mgr (state358) */
        if (roleFieldValue === ROLE_FIELD.SOP_APPROVER) {
            if (!userCtx.isAdmin && !userCtx.isSopApprover) {
                log.debug({ title: 'resolvePoActions | Not SOP Approver', details: { poId } });
                return null;
            }
            return {
                stateLabel: 'S & OP Approval (workflowstate345 — Branch B)',
                approveLabel: 'Approve',
                approveAction: ACTIONS.SOP_APPROVAL.APPROVE,
                rejectAction: ACTIONS.SOP_APPROVAL.REJECT,
                resubmitAction: ACTIONS.SOP_APPROVAL.RESUBMIT
            };
        }

        /* ══ 5. CFO REJECT → COMM DIR  (workflowstate361 — Branch D) ═
         * Reached when CFO rejects in Branch D.
         * Approve → CFO Approval (state352)
         * Reject  → Comm Dir Reject BD Mgr D (state360)
         * Resubmit → Initial (state340)                               */
        if (roleFieldValue === ROLE_FIELD.CFO_REJECT_COMM_DIR) {
            if (!userCtx.isAdmin && !userCtx.isCommDirector) {
                log.debug({ title: 'resolvePoActions | Not Comm Dir (CFO Reject state361)', details: { poId } });
                return null;
            }
            return {
                stateLabel: 'CFO Reject → Comm Dir Review (workflowstate361 — Branch D)',
                approveLabel: 'Approve',
                approveAction: ACTIONS.CFO_REJECT.APPROVE,
                rejectAction: ACTIONS.CFO_REJECT.REJECT,
                resubmitAction: ACTIONS.CFO_REJECT.RESUBMIT
            };
        }

        /* ══ 6. F&A REJECT → COMM DIR  (workflowstate363 — Branch E) ═
         * Reached when F&A Director rejects in Branch E.
         * Approve → F&A Approval (state356)
         * Reject  → Comm Dir Reject BD Mgr E (state362)
         * Resubmit → Initial (state340)                               */
        if (roleFieldValue === ROLE_FIELD.FA_REJECT_COMM_DIR) {
            if (!userCtx.isAdmin && !userCtx.isCommDirector) {
                log.debug({ title: 'resolvePoActions | Not Comm Dir (F&A Reject state363)', details: { poId } });
                return null;
            }
            return {
                stateLabel: 'F&A Reject → Comm Dir Review (workflowstate363 — Branch E)',
                approveLabel: 'Approve',
                approveAction: ACTIONS.FA_REJECT.APPROVE,
                rejectAction: ACTIONS.FA_REJECT.REJECT,
                resubmitAction: ACTIONS.FA_REJECT.RESUBMIT
            };
        }

        /* ══ 7. COMMERCIAL DIRECTOR — APPROVAL STATES ════════════════
         * roleFieldValue = 'VC - Commercial Director'
         * Covers states 348 (Branch C), 351 (Branch D), 355 (Branch E).
         * Disambiguated by amount.                                    */
        if (roleFieldValue === ROLE_FIELD.COMM_DIRECTOR) {
            if (!userCtx.isAdmin && !userCtx.isCommDirector) {
                log.debug({ title: 'resolvePoActions | Not Comm Director', details: { poId } });
                return null;
            }

            /* Branch C — Amount < 500K  (workflowstate348)
             * Approve → APPROVED; Reject → Comm Dir Reject C (state359) */
            if (amount < AMOUNT.BRANCH_BCD_MAX) {
                return {
                    stateLabel: 'Commercial Director Approval — Branch C (workflowstate348)',
                    approveLabel: 'Approve',
                    approveAction: ACTIONS.COMM_DIR_BRANCH_C.APPROVE,
                    rejectAction: ACTIONS.COMM_DIR_BRANCH_C.REJECT,
                    resubmitAction: ACTIONS.COMM_DIR_BRANCH_C.RESUBMIT
                };
            }

            /* Branch D — Amount >= 500K AND < 1M  (workflowstate351)
             * Approve → CFO Approval (state352); Reject → Comm Dir Reject D (state360) */
            if (amount < AMOUNT.BRANCH_D_MAX) {
                return {
                    stateLabel: 'Commercial Director Approval — Branch D (workflowstate351)',
                    approveLabel: 'Approve',
                    approveAction: ACTIONS.COMM_DIR_BRANCH_D.APPROVE,
                    rejectAction: ACTIONS.COMM_DIR_BRANCH_D.REJECT,
                    resubmitAction: ACTIONS.COMM_DIR_BRANCH_D.RESUBMIT
                };
            }

            /* Branch E — Amount >= 1M  (workflowstate355)
             * Approve → F&A Approval (state356)
             * Reject  → Comm Dir Reject E (state362)
             * Resubmit → Initial (state340)                             */
            return {
                stateLabel: 'Commercial Director Approval — Branch E (workflowstate355)',
                approveLabel: 'Approve',
                approveAction: ACTIONS.COMM_DIR_BRANCH_E.APPROVE,
                rejectAction: ACTIONS.COMM_DIR_BRANCH_E.REJECT,
                resubmitAction: ACTIONS.COMM_DIR_BRANCH_E.RESUBMIT
            };
        }

        /* ══ 8. CFO APPROVAL  (workflowstate352 — Branch D) ══════════
         * roleFieldValue = 'VC - CFO'  (distinct role from VC - F&A Director)
         * Approve → APPROVED; Reject → CFO Reject (state361)          */
        if (roleFieldValue === ROLE_FIELD.CFO) {
            if (!userCtx.isAdmin && !userCtx.isCfo) {
                log.debug({ title: 'resolvePoActions | Not CFO', details: { poId } });
                return null;
            }
            return {
                stateLabel: 'CFO Approval (workflowstate352 — Branch D)',
                approveLabel: 'Approve',
                approveAction: ACTIONS.CFO_APPROVAL.APPROVE,
                rejectAction: ACTIONS.CFO_APPROVAL.REJECT,
                resubmitAction: ACTIONS.CFO_APPROVAL.RESUBMIT
            };
        }

        /* ══ 9. CEO REJECT → F&A DIRECTOR  (workflowstate364 — Branch E) ═
         * Reached when CEO rejects in Branch E.
         * Approve → CEO Approval (state357)
         * Reject  → F&A Reject → Comm Dir (state363)
         * Resubmit → Initial (state340)                               */
        if (roleFieldValue === ROLE_FIELD.CEO_REJECT_FA) {
            if (!userCtx.isAdmin && !userCtx.isFaDirector) {
                log.debug({ title: 'resolvePoActions | Not F&A Director (CEO Reject state364)', details: { poId } });
                return null;
            }
            return {
                stateLabel: 'CEO Reject → F&A Director Review (workflowstate364 — Branch E)',
                approveLabel: 'Approve',
                approveAction: ACTIONS.CEO_REJECT.APPROVE,
                rejectAction: ACTIONS.CEO_REJECT.REJECT,
                resubmitAction: ACTIONS.CEO_REJECT.RESUBMIT
            };
        }

        /* ══ 10. F&A DIRECTOR APPROVAL  (workflowstate356 — Branch E) ═
         * roleFieldValue = 'VC - F&A Director'  (checked after CEO_REJECT_FA marker)
         * Approve → CEO Approval (state357)
         * Reject  → F&A Reject → Comm Dir (state363)                 */
        if (roleFieldValue === ROLE_FIELD.FA_DIRECTOR) {
            if (!userCtx.isAdmin && !userCtx.isFaDirector) {
                log.debug({ title: 'resolvePoActions | Not F&A Director', details: { poId } });
                return null;
            }
            return {
                stateLabel: 'F&A Director Approval (workflowstate356 — Branch E)',
                approveLabel: 'Approve',
                approveAction: ACTIONS.FA_APPROVAL.APPROVE,
                rejectAction: ACTIONS.FA_APPROVAL.REJECT,
                resubmitAction: ACTIONS.FA_APPROVAL.RESUBMIT
            };
        }

        /* ══ 11. CEO APPROVAL  (workflowstate357 — Branch E) ══════════
         * roleFieldValue = 'VC - Chief Executive Officer'
         * Approve → APPROVED (state291)
         * Reject  → CEO Reject → F&A (state364)
         * Resubmit → Initial (state340)                               */
        if (roleFieldValue === ROLE_FIELD.CEO) {
            if (!userCtx.isAdmin && !userCtx.isCeo) {
                log.debug({ title: 'resolvePoActions | Not CEO', details: { poId } });
                return null;
            }
            return {
                stateLabel: 'CEO Approval (workflowstate357 — Branch E)',
                approveLabel: 'Approve',
                approveAction: ACTIONS.CEO_APPROVAL.APPROVE,
                rejectAction: ACTIONS.CEO_APPROVAL.REJECT,
                resubmitAction: ACTIONS.CEO_APPROVAL.RESUBMIT
            };
        }

        // Unrecognized state — log and return null
        log.debug({ title: 'resolvePoActions | Unrecognized roleFieldValue', details: { roleFieldValue, poId } });
        return null;
    }

    /* =====================================================
     * TRIGGER WORKFLOW ACTION (WRAPPER)
     * ===================================================== */
    function triggerWorkflow(recordId, actionId, actionLabel) {
        log.debug({
            title: 'triggerWorkflow | Triggering',
            details: { recordId, actionId, actionLabel, workflowId: WORKFLOW_ID }
        });
        workflow.trigger({
            recordType: 'purchaseorder',
            recordId: recordId,
            workflowId: WORKFLOW_ID,
            actionId: actionId
        });
        log.debug({ title: 'triggerWorkflow | Success', details: { recordId, actionId } });
    }

    /* =====================================================
     * APPROVE
     * ===================================================== */
    function approvePurchaseOrders(ids) {
        const ctx = getUserContext();
        const errors = [];
        log.debug({ title: 'approvePurchaseOrders | Start', details: { ids } });

        for (let i = 0; i < ids.length; i++) {
            const poId = ids[i];
            try {
                const actions = resolvePoActions(poId, ctx);
                if (!actions || !actions.approveAction) {
                    errors.push({ poId, message: 'Approve action not available for this state or user.' });
                    continue;
                }
                log.debug({ title: 'approvePurchaseOrders | Approving', details: { poId, state: actions.stateLabel } });
                triggerWorkflow(poId, actions.approveAction, `Approve | ${actions.stateLabel}`);
            } catch (e) {
                log.error({ title: 'approvePurchaseOrders | Error ' + poId, details: e });
                errors.push({ poId, message: e.message });
            }
        }
        return { success: errors.length === 0, errors };
    }

    /* =====================================================
     * REJECT
     * ===================================================== */
    function rejectPurchaseOrders(ids) {
        const ctx = getUserContext();
        const errors = [];
        log.debug({ title: 'rejectPurchaseOrders | Start', details: { ids } });

        for (let i = 0; i < ids.length; i++) {
            const poId = ids[i];
            try {
                const actions = resolvePoActions(poId, ctx);
                if (!actions || !actions.rejectAction) {
                    errors.push({ poId, message: 'Reject action not available for this state or user.' });
                    continue;
                }
                log.debug({ title: 'rejectPurchaseOrders | Rejecting', details: { poId, state: actions.stateLabel } });
                triggerWorkflow(poId, actions.rejectAction, `Reject | ${actions.stateLabel}`);
            } catch (e) {
                log.error({ title: 'rejectPurchaseOrders | Error ' + poId, details: e });
                errors.push({ poId, message: e.message });
            }
        }
        return { success: errors.length === 0, errors };
    }

    /* =====================================================
     * RESUBMIT
     * Not available from Initial State (resubmitAction = null there).
     * ===================================================== */
    function resubmitPurchaseOrders(ids) {
        const ctx = getUserContext();
        const errors = [];
        log.debug({ title: 'resubmitPurchaseOrders | Start', details: { ids } });

        for (let i = 0; i < ids.length; i++) {
            const poId = ids[i];
            try {
                const actions = resolvePoActions(poId, ctx);
                if (!actions || !actions.resubmitAction) {
                    errors.push({ poId, message: 'Re-Submit is not available from this state.' });
                    continue;
                }
                log.debug({ title: 'resubmitPurchaseOrders | Resubmitting', details: { poId, state: actions.stateLabel } });
                triggerWorkflow(poId, actions.resubmitAction, `Re-Submit | ${actions.stateLabel}`);
            } catch (e) {
                log.error({ title: 'resubmitPurchaseOrders | Error ' + poId, details: e });
                errors.push({ poId, message: e.message });
            }
        }
        return { success: errors.length === 0, errors };
    }

    /* =====================================================
     * LOOKUP HELPERS
     * ===================================================== */
    function getVendors() {
        const vendors = [];
        search.create({
            type: search.Type.VENDOR,
            filters: [['isinactive', 'is', 'F']],
            columns: ['entityid', 'companyname']
        }).run().each(r => {
            vendors.push({ id: r.id, name: r.getValue('companyname') || r.getValue('entityid') });
            return true;
        });
        return { success: true, data: vendors };
    }

    function getLocations() {
        const locations = [];
        search.create({
            type: search.Type.LOCATION,
            filters: [['isinactive', 'is', 'F']],
            columns: ['name']
        }).run().each(r => {
            locations.push({ id: r.id, name: r.getValue('name') });
            return true;
        });
        return { success: true, data: locations };
    }

    function getSubsidiaries() {
        const subsidiaries = [];
        search.create({
            type: search.Type.SUBSIDIARY,
            filters: [['isinactive', 'is', 'F']],
            columns: ['name']
        }).run().each(r => {
            subsidiaries.push({ id: r.id, name: r.getValue('name') });
            return true;
        });
        return { success: true, data: subsidiaries };
    }

    /* =====================================================
     * DATE FORMATTER  YYYY-MM-DD → DD/MM/YYYY
     * ===================================================== */
    function formatDateToDDMMYYYY(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    return { onRequest };
});