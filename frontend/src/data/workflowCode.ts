import type { WorkerLanguage } from "../types";

/**
 * Code line definition for the workflow code viewer.
 *
 * To add a new language:
 * 1. Add a new entry to WORKFLOW_LANGUAGES
 * 2. Add the language's code lines + compensation lines
 * 3. Add syntax highlighting rules
 * 4. Update the WorkerLanguage type in types/index.ts
 */

export interface CodeLine {
  text: string;
  indent: number;
  step?: string; // maps to an activity step name for highlighting
  isComment?: boolean;
  isDecorator?: boolean;
  isBlank?: boolean;
}

export interface LanguageDef {
  id: WorkerLanguage;
  label: string;
  filename: string;
  code: CodeLine[];
  compensation: CodeLine[];
  /** Regex rules applied in order; className is a kit code-view token: k keyword, f function, s string, t type/number/constant */
  highlighting: { pattern: RegExp; className: string }[];
}

// ─── Python ──────────────────────────────────────────────────────

const pythonCode: CodeLine[] = [
  { text: "@workflow.defn", indent: 0, isDecorator: true },
  { text: "class OrderWorkflow:", indent: 0 },
  { text: "", indent: 0, isBlank: true },
  { text: "@workflow.run", indent: 1, isDecorator: true },
  { text: "async def run(self, order):", indent: 1 },
  { text: "    compensations = []", indent: 1 },
  { text: "    try:", indent: 1 },
  { text: "", indent: 0, isBlank: true },
  { text: "# Validate the order and store", indent: 3, isComment: true },
  {
    text: "await workflow.execute_activity(",
    indent: 4,
    step: "validate_order",
  },
  {
    text: "  validate_order, order)",
    indent: 4,
    step: "validate_order",
  },
  {
    text: "await workflow.execute_activity(",
    indent: 4,
    step: "validate_store",
  },
  {
    text: "  validate_store, order)",
    indent: 4,
    step: "validate_store",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "# Hold payment, register compensation first",
    indent: 4,
    isComment: true,
  },
  {
    text: "compensations.append(release_hold)",
    indent: 4,
    step: "authorize_payment",
  },
  {
    text: "auth = await workflow.execute_activity(",
    indent: 4,
    step: "authorize_payment",
  },
  {
    text: "  authorize_payment, order)",
    indent: 4,
    step: "authorize_payment",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "await workflow.execute_activity(",
    indent: 4,
    step: "clear_cart",
  },
  { text: "  clear_cart, order)", indent: 4, step: "clear_cart" },
  { text: "", indent: 0, isBlank: true },
  { text: "# Submit — retries automatically", indent: 3, isComment: true },
  {
    text: "await workflow.execute_activity(",
    indent: 4,
    step: "submit_to_store",
  },
  {
    text: "  submit_to_store, order,",
    indent: 4,
    step: "submit_to_store",
  },
  {
    text: "  retry=RetryPolicy(max=10))",
    indent: 4,
    step: "submit_to_store",
  },
  { text: "", indent: 0, isBlank: true },
  { text: "# Wait for signal — human in the loop", indent: 3, isComment: true },
  {
    text: "await workflow.wait_condition(",
    indent: 4,
    step: "order_ready",
  },
  {
    text: "  lambda: self.order_ready)",
    indent: 4,
    step: "order_ready",
  },
  { text: "", indent: 0, isBlank: true },
  { text: "# Capture only after confirmation", indent: 3, isComment: true },
  {
    text: "await workflow.execute_activity(",
    indent: 4,
    step: "capture_payment",
  },
  {
    text: "  capture_payment, auth)",
    indent: 4,
    step: "capture_payment",
  },
];

const pythonCompensation: CodeLine[] = [
  { text: "", indent: 0, isBlank: true },
  { text: "# Saga: run compensations in reverse", indent: 2, isComment: true },
  { text: "except Exception:", indent: 2 },
  {
    text: "for comp in reversed(compensations):",
    indent: 3,
    step: "release_payment_hold",
  },
  { text: "await comp()", indent: 4, step: "release_payment_hold" },
];

const pythonHighlighting = [
  {
    pattern:
      /\b(class|async|def|await|if|return|except|lambda|self|for|in|try)\b/g,
    className: "k",
  },
  { pattern: /\b(workflow|RetryPolicy)\b/g, className: "t" },
  {
    pattern:
      /(validate_order|validate_store|authorize_payment|clear_cart|submit_to_store|capture_payment|release_payment_hold|release_hold|wait_condition|execute_activity|order_ready|compensations|reversed|append)\b/g,
    className: "f",
  },
  { pattern: /(max)=/g, className: "t" },
  { pattern: /\b(\d+)\b/g, className: "t" },
];

// ─── Go ──────────────────────────────────────────────────────────

const goCode: CodeLine[] = [
  { text: "type Compensations []any", indent: 0 },

  {
    text: "func (s *Compensations) AddCompensation(activity any) {",
    indent: 0,
  },
  { text: "*s = append(*s, activity)", indent: 1 },
  {
    text: "}",
    indent: 0,
  },
  { text: "", indent: 0 },
  { text: "func OrderWorkflow(ctx workflow.Context,", indent: 0 },
  { text: "    order OrderInput) (result Result, err error) {", indent: 0 },
  { text: "", indent: 0, isBlank: true },
  { text: "var compensations Compensations", indent: 1 },
  { text: "defer func() {", indent: 1 },
  { text: "    if err != nil {", indent: 1 },
  {
    text: "        compensations.Compensate(ctx)",
    indent: 1,
    step: "release_payment_hold",
  },
  { text: "    }", indent: 1 },
  { text: "}()", indent: 1 },
  { text: "", indent: 0, isBlank: true },
  { text: "// Validate order and store", indent: 1, isComment: true },
  {
    text: "err := workflow.ExecuteActivity(ctx,",
    indent: 1,
    step: "validate_order",
  },
  {
    text: '    "ValidateOrder", order).Get(ctx, nil)',
    indent: 1,
    step: "validate_order",
  },
  {
    text: "err = workflow.ExecuteActivity(ctx,",
    indent: 1,
    step: "validate_store",
  },
  {
    text: '    "ValidateStore", order).Get(ctx, nil)',
    indent: 1,
    step: "validate_store",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Hold payment — register compensation first",
    indent: 1,
    isComment: true,
  },
  {
    text: 'compensations.AddCompensation("ReleasePaymentHold", order)',
    indent: 1,
    step: "authorize_payment",
  },
  {
    text: "err = workflow.ExecuteActivity(ctx,",
    indent: 1,
    step: "authorize_payment",
  },
  {
    text: '    "AuthorizePayment", order).Get(ctx, &auth)',
    indent: 1,
    step: "authorize_payment",
  },
  { text: "", indent: 0, isBlank: true },
  { text: "workflow.ExecuteActivity(ctx,", indent: 1, step: "clear_cart" },
  {
    text: '    "ClearCart", order).Get(ctx, nil)',
    indent: 1,
    step: "clear_cart",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Submit to store — retries automatically",
    indent: 1,
    isComment: true,
  },
  {
    text: "submitCtx := workflow.WithActivityOptions(ctx,",
    indent: 1,
    step: "submit_to_store",
  },
  {
    text: "    RetryPolicy{MaxAttempts: 10})",
    indent: 1,
    step: "submit_to_store",
  },
  {
    text: "workflow.ExecuteActivity(submitCtx,",
    indent: 1,
    step: "submit_to_store",
  },
  {
    text: '    "SubmitToStore", order).Get(ctx, nil)',
    indent: 1,
    step: "submit_to_store",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Wait for signal — human in the loop",
    indent: 1,
    isComment: true,
  },
  {
    text: 'workflow.GetSignalChannel(ctx, "order_ready")',
    indent: 1,
    step: "order_ready",
  },
  { text: "    .Receive(ctx, nil)", indent: 1, step: "order_ready" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Capture only after confirmation", indent: 1, isComment: true },
  { text: "workflow.ExecuteActivity(ctx,", indent: 1, step: "capture_payment" },
  {
    text: '    "CapturePayment", order).Get(ctx, nil)',
    indent: 1,
    step: "capture_payment",
  },
  { text: "", indent: 0, isBlank: true },
  { text: "return Result{Success: true}, nil", indent: 1 },
  { text: "}", indent: 0 },
];

// Go compensation is handled by the defer block at the top of the workflow,
// which already has step: 'release_payment_hold' for highlighting.
const goCompensation: CodeLine[] = [];

const goHighlighting = [
  {
    pattern:
      /\b(func|var|err|return|for|if|range|nil|true|false|append|len|defer)\b/g,
    className: "k",
  },
  {
    pattern:
      /\b(workflow|temporal|RetryPolicy|Context|OrderInput|Result|Compensations)\b/g,
    className: "t",
  },
  {
    pattern:
      /(ExecuteActivity|WithActivityOptions|GetSignalChannel|Receive|Get|NewDisconnectedContext|MaxAttempts|AddCompensation|Compensate|Await)\b/g,
    className: "f",
  },
  {
    pattern:
      /("ValidateOrder"|"ValidateStore"|"AuthorizePayment"|"ClearCart"|"SubmitToStore"|"CapturePayment"|"order_ready")/g,
    className: "s",
  },
  { pattern: /\b(\d+)\b/g, className: "t" },
];

// ─── TypeScript ─────────────────────────────────────────────────

const typescriptCode: CodeLine[] = [
  { text: "const acts = proxyActivities<Activities>({", indent: 0 },
  { text: "  startToCloseTimeout: '10s',", indent: 0 },
  { text: "  retry: { maximumAttempts: 3 } })", indent: 0 },
  { text: "", indent: 0, isBlank: true },
  { text: "export async function OrderWorkflow(", indent: 0 },
  { text: "  order: OrderInput): Promise<Result> {", indent: 0 },
  { text: "", indent: 0, isBlank: true },
  { text: "let orderReady = false", indent: 1 },
  { text: "setHandler(orderReadySignal,", indent: 1 },
  { text: "  () => { orderReady = true })", indent: 1 },
  { text: "", indent: 0, isBlank: true },
  { text: "const compensations: Compensation[] = []", indent: 1 },
  { text: "try {", indent: 1 },
  { text: "", indent: 0, isBlank: true },
  { text: "// Validate the order and store", indent: 2, isComment: true },
  { text: "await acts.validateOrder(order)", indent: 2, step: "validate_order" },
  { text: "await acts.validateStore(order)", indent: 2, step: "validate_store" },
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Hold payment — register compensation first",
    indent: 2,
    isComment: true,
  },
  {
    text: "compensations.push(() =>",
    indent: 2,
    step: "authorize_payment",
  },
  {
    text: "  acts.releasePaymentHold(order))",
    indent: 2,
    step: "authorize_payment",
  },
  {
    text: "const auth = await acts.authorizePayment(",
    indent: 2,
    step: "authorize_payment",
  },
  { text: "  order)", indent: 2, step: "authorize_payment" },
  { text: "", indent: 0, isBlank: true },
  { text: "await acts.clearCart(order)", indent: 2, step: "clear_cart" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Submit — retries automatically", indent: 2, isComment: true },
  {
    text: "await submitActs.submitToStore(order)",
    indent: 2,
    step: "submit_to_store",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Wait for signal — human in the loop",
    indent: 2,
    isComment: true,
  },
  { text: "await condition(() => orderReady)", indent: 2, step: "order_ready" },
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Capture only after confirmation",
    indent: 2,
    isComment: true,
  },
  { text: "await acts.capturePayment(auth)", indent: 2, step: "capture_payment" },
];

const typescriptCompensation: CodeLine[] = [
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Saga: run compensations in reverse",
    indent: 1,
    isComment: true,
  },
  { text: "} catch (err) {", indent: 1 },
  {
    text: "  await CancellationScope.nonCancellable(",
    indent: 1,
  },
  { text: "    async () => {", indent: 1 },
  {
    text: "      for (const comp of compensations.reverse())",
    indent: 1,
    step: "release_payment_hold",
  },
  { text: "        await comp()", indent: 1, step: "release_payment_hold" },
  { text: "  })", indent: 1 },
  { text: "}", indent: 1 },
];

const typescriptHighlighting = [
  {
    pattern:
      /\b(const|let|async|function|await|return|for|of|try|catch|export|throw|new)\b/g,
    className: "k",
  },
  {
    pattern:
      /\b(proxyActivities|CancellationScope|condition|setHandler|defineSignal|defineQuery)\b/g,
    className: "t",
  },
  {
    pattern:
      /(validateOrder|validateStore|authorizePayment|clearCart|submitToStore|capturePayment|releasePaymentHold|notifyCustomer|nonCancellable|compensations|reverse|orderReady|orderReadySignal)\b/g,
    className: "f",
  },
  {
    pattern: /\b(Activities|OrderInput|Result|Compensation|Promise)\b/g,
    className: "s",
  },
  { pattern: /'[^']*'/g, className: "s" },
  { pattern: /\b(\d+)\b/g, className: "t" },
];

// ─── Java ───────────────────────────────────────────────────────
// Java SDK has first-class Saga support via the Saga class.

const javaCode: CodeLine[] = [
  { text: "OrderActivities acts = Workflow.newActivityStub(", indent: 0 },
  { text: "    OrderActivities.class, defaultOptions)", indent: 0 },
  { text: "", indent: 0, isBlank: true },
  { text: "public Map<String, Object> run(", indent: 0 },
  { text: "    Map<String, Object> order) {", indent: 0 },
  { text: "", indent: 0, isBlank: true },
  { text: "// Built-in Saga manages compensations", indent: 1, isComment: true },
  { text: "Saga saga = new Saga(new Saga.Options.Builder()", indent: 1 },
  { text: "    .setContinueWithError(true).build())", indent: 1 },
  { text: "try {", indent: 1 },
  { text: "", indent: 0, isBlank: true },
  { text: "// Validate the order and store", indent: 2, isComment: true },
  { text: "acts.validateOrder(order)", indent: 2, step: "validate_order" },
  { text: "acts.validateStore(order)", indent: 2, step: "validate_store" },
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Hold payment — register compensation first",
    indent: 2,
    isComment: true,
  },
  {
    text: "saga.addCompensation(() ->",
    indent: 2,
    step: "authorize_payment",
  },
  {
    text: "    acts.releasePaymentHold(order))",
    indent: 2,
    step: "authorize_payment",
  },
  {
    text: "auth = acts.authorizePayment(order)",
    indent: 2,
    step: "authorize_payment",
  },
  { text: "", indent: 0, isBlank: true },
  { text: "acts.clearCart(order)", indent: 2, step: "clear_cart" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Submit — retries automatically", indent: 2, isComment: true },
  {
    text: "submitActs.submitToStore(order)",
    indent: 2,
    step: "submit_to_store",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Wait for signal — human in the loop",
    indent: 2,
    isComment: true,
  },
  { text: "Workflow.await(() -> orderReady)", indent: 2, step: "order_ready" },
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Capture only after confirmation",
    indent: 2,
    isComment: true,
  },
  { text: "acts.capturePayment(auth)", indent: 2, step: "capture_payment" },
];

const javaCompensation: CodeLine[] = [
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Saga.compensate() runs in reverse,",
    indent: 1,
    isComment: true,
  },
  {
    text: "// inside a detached cancellation scope",
    indent: 1,
    isComment: true,
  },
  { text: "} catch (Exception e) {", indent: 1 },
  { text: "    saga.compensate()", indent: 1, step: "release_payment_hold" },
  { text: "}", indent: 1 },
];

const javaHighlighting = [
  {
    pattern:
      /\b(public|class|interface|void|new|try|catch|return|Map|String|Object)\b/g,
    className: "k",
  },
  {
    pattern: /\b(Workflow|Saga|OrderActivities|ActivityOptions|RetryOptions)\b/g,
    className: "t",
  },
  {
    pattern:
      /(validateOrder|validateStore|authorizePayment|clearCart|submitToStore|capturePayment|releasePaymentHold|notifyCustomer|addCompensation|compensate|await|newActivityStub|orderReady)\b/g,
    className: "f",
  },
  {
    pattern:
      /\b(OrderInput|Options|Builder)\b/g,
    className: "s",
  },
  { pattern: /@\w+/g, className: "k" },
  { pattern: /\b(\d+)\b/g, className: "t" },
  { pattern: /\b(true|false|null)\b/g, className: "t" },
];

// ─── .NET (C#) ──────────────────────────────────────────────────

const dotnetCode: CodeLine[] = [
  { text: "[Workflow(\"OrderWorkflow\")]", indent: 0, isDecorator: true },
  { text: "public class OrderWorkflow {", indent: 0 },
  { text: "", indent: 0, isBlank: true },
  { text: "[WorkflowRun]", indent: 1, isDecorator: true },
  { text: "public async Task<Result> RunAsync(", indent: 1 },
  { text: "    OrderInput order) {", indent: 1 },
  { text: "", indent: 0, isBlank: true },
  { text: "var compensations = new List<Func<Task>>()", indent: 2 },
  { text: "try {", indent: 2 },
  { text: "", indent: 0, isBlank: true },
  { text: "// Validate the order and store", indent: 3, isComment: true },
  {
    text: "await Workflow.ExecuteActivityAsync(",
    indent: 3,
    step: "validate_order",
  },
  {
    text: "  (a) => a.ValidateOrder(order), options)",
    indent: 3,
    step: "validate_order",
  },
  {
    text: "await Workflow.ExecuteActivityAsync(",
    indent: 3,
    step: "validate_store",
  },
  {
    text: "  (a) => a.ValidateStore(order), options)",
    indent: 3,
    step: "validate_store",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Hold payment — register compensation first",
    indent: 3,
    isComment: true,
  },
  {
    text: "compensations.Add(() =>",
    indent: 3,
    step: "authorize_payment",
  },
  {
    text: "  ExecuteActivityAsync(",
    indent: 3,
    step: "authorize_payment",
  },
  {
    text: "    (a) => a.ReleasePaymentHold(order)))",
    indent: 3,
    step: "authorize_payment",
  },
  {
    text: "var auth = await Workflow.ExecuteActivityAsync(",
    indent: 3,
    step: "authorize_payment",
  },
  {
    text: "  (a) => a.AuthorizePayment(order), options)",
    indent: 3,
    step: "authorize_payment",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "await Workflow.ExecuteActivityAsync(",
    indent: 3,
    step: "clear_cart",
  },
  {
    text: "  (a) => a.ClearCart(order), options)",
    indent: 3,
    step: "clear_cart",
  },
  { text: "", indent: 0, isBlank: true },
  { text: "// Submit — retries automatically", indent: 3, isComment: true },
  {
    text: "await Workflow.ExecuteActivityAsync(",
    indent: 3,
    step: "submit_to_store",
  },
  {
    text: "  (a) => a.SubmitToStore(order), submitOpts)",
    indent: 3,
    step: "submit_to_store",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Wait for signal — human in the loop",
    indent: 3,
    isComment: true,
  },
  {
    text: "await Workflow.WaitConditionAsync(",
    indent: 3,
    step: "order_ready",
  },
  { text: "  () => orderReady)", indent: 3, step: "order_ready" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Capture only after confirmation", indent: 3, isComment: true },
  {
    text: "await Workflow.ExecuteActivityAsync(",
    indent: 3,
    step: "capture_payment",
  },
  {
    text: "  (a) => a.CapturePayment(auth), options)",
    indent: 3,
    step: "capture_payment",
  },
];

const dotnetCompensation: CodeLine[] = [
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Saga: run compensations in reverse",
    indent: 2,
    isComment: true,
  },
  { text: "} catch (Exception) {", indent: 2 },
  {
    text: "  for (var i = compensations.Count - 1; i >= 0; i--)",
    indent: 2,
    step: "release_payment_hold",
  },
  {
    text: "    await compensations[i]()",
    indent: 2,
    step: "release_payment_hold",
  },
  { text: "}", indent: 2 },
];

const dotnetHighlighting = [
  {
    pattern:
      /\b(public|class|async|await|var|new|try|catch|return|for|int)\b/g,
    className: "k",
  },
  {
    pattern:
      /\b(Workflow|Task|List|Func|ActivityOptions|RetryPolicy)\b/g,
    className: "t",
  },
  {
    pattern:
      /(ValidateOrder|ValidateStore|AuthorizePayment|ClearCart|SubmitToStore|CapturePayment|ReleasePaymentHold|NotifyCustomer|ExecuteActivityAsync|WaitConditionAsync|Add|compensations|orderReady)\b/g,
    className: "f",
  },
  {
    pattern: /\b(OrderInput|OrderWorkflow|Result|Exception)\b/g,
    className: "s",
  },
  { pattern: /\[.*?\]/g, className: "k" },
  { pattern: /\b(\d+)\b/g, className: "t" },
  { pattern: /\b(true|false|null)\b/g, className: "t" },
];

// ─── Rust ───────────────────────────────────────────────────────

const rustCode: CodeLine[] = [
  { text: "#[workflow]", indent: 0, isDecorator: true },
  { text: "#[derive(Default)]", indent: 0, isDecorator: true },
  { text: "pub struct OrderWorkflow { order_ready: bool, status: String }", indent: 0 },
  { text: "", indent: 0, isBlank: true },
  { text: "#[workflow_methods]", indent: 0, isDecorator: true },
  { text: "impl OrderWorkflow {", indent: 0 },
  { text: "#[run]", indent: 1, isDecorator: true },
  { text: "pub async fn run(ctx: &mut WorkflowContext<Self>,", indent: 1 },
  { text: "    order: OrderInput) -> WorkflowResult<OrderResult> {", indent: 1 },
  { text: "let mut compensations: Vec<OrderInput> = Vec::new();", indent: 2 },
  { text: "let result = Self::process_order(ctx, &order,", indent: 2 },
  { text: "    &mut compensations).await;", indent: 2 },
  { text: "", indent: 0, isBlank: true },
  { text: "// process_order: the steps, top to bottom", indent: 2, isComment: true },
  { text: "// Validate the order and store", indent: 2, isComment: true },
  { text: "ctx.execute_activity(OrderActivities::validate_order,", indent: 2, step: "validate_order" },
  { text: "    order.clone(), activity_options(10)).await?;", indent: 2, step: "validate_order" },
  { text: "ctx.execute_activity(OrderActivities::validate_store,", indent: 2, step: "validate_store" },
  { text: "    order.clone(), activity_options(10)).await?;", indent: 2, step: "validate_store" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Hold payment — register compensation first", indent: 2, isComment: true },
  { text: "compensations.push(order.clone());", indent: 2, step: "authorize_payment" },
  { text: "let payment = ctx.execute_activity(", indent: 2, step: "authorize_payment" },
  { text: "    OrderActivities::authorize_payment,", indent: 2, step: "authorize_payment" },
  { text: "    order.clone(), activity_options(15)).await?;", indent: 2, step: "authorize_payment" },
  { text: "", indent: 0, isBlank: true },
  { text: "ctx.execute_activity(OrderActivities::clear_cart,", indent: 2, step: "clear_cart" },
  { text: "    order.clone(), activity_options(5)).await?;", indent: 2, step: "clear_cart" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Submit — retries automatically", indent: 2, isComment: true },
  { text: "let submit_options = ActivityOptions::with_start_to_close_timeout(", indent: 2, step: "submit_to_store" },
  { text: "    Duration::from_secs(10))", indent: 2, step: "submit_to_store" },
  { text: "    .retry_policy(RetryPolicy::builder()", indent: 2, step: "submit_to_store" },
  { text: "        .maximum_attempts(10).build()).build();", indent: 2, step: "submit_to_store" },
  { text: "ctx.execute_activity(OrderActivities::submit_to_store,", indent: 2, step: "submit_to_store" },
  { text: "    order.clone(), submit_options).await?;", indent: 2, step: "submit_to_store" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Wait for signal — human in the loop", indent: 2, isComment: true },
  { text: "ctx.wait_condition(|s| s.order_ready).await?;", indent: 2, step: "order_ready" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Capture only after confirmation", indent: 2, isComment: true },
  { text: "ctx.execute_activity(OrderActivities::capture_payment,", indent: 2, step: "capture_payment" },
  { text: "    capture_input, activity_options(15)).await?;", indent: 2, step: "capture_payment" },
];

const rustCompensation: CodeLine[] = [
  { text: "", indent: 0, isBlank: true },
  { text: "// Saga: run compensations in reverse", indent: 2, isComment: true },
  { text: "// A fresh token detaches them from cancellation", indent: 2, isComment: true },
  { text: "let detached = WorkflowCancellationToken::new();", indent: 2, step: "release_payment_hold" },
  { text: "for input in compensations.into_iter().rev() {", indent: 2, step: "release_payment_hold" },
  { text: "let options = ActivityOptions::with_start_to_close_timeout(", indent: 3, step: "release_payment_hold" },
  { text: "    Duration::from_secs(10))", indent: 3, step: "release_payment_hold" },
  { text: "    .retry_policy(RetryPolicy::builder()", indent: 3, step: "release_payment_hold" },
  { text: "        .maximum_attempts(5).build())", indent: 3, step: "release_payment_hold" },
  { text: "    .cancellation_token(detached.clone()).build();", indent: 3, step: "release_payment_hold" },
  { text: "ctx.execute_activity(", indent: 3, step: "release_payment_hold" },
  { text: "    OrderActivities::release_payment_hold,", indent: 3, step: "release_payment_hold" },
  { text: "    input, options).await;", indent: 3, step: "release_payment_hold" },
  { text: "}", indent: 2 },
  { text: "}", indent: 1 },
  { text: "}", indent: 0 },
];

const rustHighlighting = [
  {
    pattern:
      /\b(pub|struct|impl|async|fn|await|let|mut|for|in|if|self|return)\b/g,
    className: "k",
  },
  {
    pattern: /\b(WorkflowContext|WorkflowResult|WorkflowCancellationToken|ActivityOptions|OrderActivities|RetryPolicy|Duration|Vec|Self)\b/g,
    className: "t",
  },
  {
    pattern:
      /(validate_order|validate_store|authorize_payment|clear_cart|submit_to_store|capture_payment|release_payment_hold|execute_activity|process_order|wait_condition|order_ready|compensations|push|into_iter|rev|retry_policy|maximum_attempts)\b/g,
    className: "f",
  },
  {
    pattern: /\b(OrderInput|OrderResult|OrderWorkflow)\b/g,
    className: "s",
  },
  { pattern: /\b(\d+)\b/g, className: "t" },
  { pattern: /\b(true|false)\b/g, className: "t" },
];

// ─── PHP ────────────────────────────────────────────────────────
// PHP SDK ships a Saga helper and uses generators (yield) for awaiting.

const phpCode: CodeLine[] = [
  { text: "#[WorkflowInterface]", indent: 0, isDecorator: true },
  { text: "class OrderWorkflow {", indent: 0 },
  { text: "private bool $orderReady = false;", indent: 1 },
  { text: "", indent: 0, isBlank: true },
  { text: "#[SignalMethod(name: 'order_ready')]", indent: 1, isDecorator: true },
  { text: "public function orderReady(): void {", indent: 1 },
  { text: "$this->orderReady = true;", indent: 2 },
  { text: "}", indent: 1 },
  { text: "", indent: 0, isBlank: true },
  { text: "#[WorkflowMethod(name: 'OrderWorkflow')]", indent: 1, isDecorator: true },
  { text: "public function run(array $order) {", indent: 1 },
  { text: "$saga = (new Saga())->setContinueWithError(true);", indent: 2 },
  { text: "try {", indent: 2 },
  { text: "", indent: 0, isBlank: true },
  { text: "// Validate the order and store", indent: 3, isComment: true },
  { text: "yield $acts(10)->validateOrder($order);", indent: 3, step: "validate_order" },
  { text: "yield $acts(10)->validateStore($order);", indent: 3, step: "validate_store" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Hold payment — register compensation first", indent: 3, isComment: true },
  { text: "$saga->addCompensation(function () use ($order, &$authorizationId, $retryFive) {", indent: 3, step: "authorize_payment" },
  { text: "    $releaseActs = $this->activities(10, $retryFive);", indent: 3, step: "authorize_payment" },
  { text: "    yield $releaseActs->releasePaymentHold([...$order,", indent: 3, step: "authorize_payment" },
  { text: "        'authorization_id' => $authorizationId]);", indent: 3, step: "authorize_payment" },
  { text: "});", indent: 3, step: "authorize_payment" },
  { text: "$payment = yield $acts(15)->authorizePayment($order);", indent: 3, step: "authorize_payment" },
  { text: "", indent: 0, isBlank: true },
  { text: "yield $acts(5)->clearCart($order);", indent: 3, step: "clear_cart" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Submit — retries automatically", indent: 3, isComment: true },
  { text: "yield $submitActs->submitToStore($order);", indent: 3, step: "submit_to_store" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Wait for signal — human in the loop", indent: 3, isComment: true },
  { text: "yield Workflow::await(fn () => $this->orderReady);", indent: 3, step: "order_ready" },
  { text: "", indent: 0, isBlank: true },
  { text: "// Capture only after confirmation", indent: 3, isComment: true },
  { text: "yield $acts(15)->capturePayment([...$order,", indent: 3, step: "capture_payment" },
  { text: "    'authorization_id' => $authorizationId]);", indent: 3, step: "capture_payment" },
];

const phpCompensation: CodeLine[] = [
  { text: "", indent: 0, isBlank: true },
  { text: "// Saga: compensate() runs in reverse, detached", indent: 2, isComment: true },
  { text: "} catch (TemporalFailure $e) {", indent: 2 },
  { text: "yield $saga->compensate();", indent: 3, step: "release_payment_hold" },
  { text: "}", indent: 2 },
  { text: "}", indent: 1 },
  { text: "}", indent: 0 },
];

const phpHighlighting = [
  {
    pattern:
      /\b(class|public|private|function|fn|new|try|catch|throw|yield|return|array|bool|void|use)\b/g,
    className: "k",
  },
  { pattern: /\$this\b/g, className: "k" },
  {
    pattern: /\b(Workflow|Saga|TemporalFailure)\b/g,
    className: "t",
  },
  {
    pattern:
      /(validateOrder|validateStore|authorizePayment|clearCart|submitToStore|capturePayment|releasePaymentHold|addCompensation|compensate|await|orderReady|submitActs|acts)\b/g,
    className: "f",
  },
  { pattern: /\$\w+/g, className: "f" },
  { pattern: /\b(OrderWorkflow)\b/g, className: "s" },
  { pattern: /\b(true|false|null)\b/g, className: "t" },
];

// ─── Ruby ───────────────────────────────────────────────────────

const rubyCode: CodeLine[] = [
  { text: "class OrderWorkflow < Temporalio::Workflow::Definition", indent: 0 },
  { text: "workflow_name 'OrderWorkflow'", indent: 1 },
  { text: "Workflow = Temporalio::Workflow", indent: 1 },
  { text: "", indent: 0, isBlank: true },
  { text: "workflow_signal", indent: 1, isDecorator: true },
  { text: "def order_ready", indent: 1 },
  { text: "@order_ready = true", indent: 2 },
  { text: "end", indent: 1 },
  { text: "", indent: 0, isBlank: true },
  { text: "def execute(order)", indent: 1 },
  { text: "compensations = []", indent: 2 },
  { text: "begin", indent: 2 },
  { text: "", indent: 0, isBlank: true },
  { text: "# Validate the order and store", indent: 3, isComment: true },
  { text: "Workflow.execute_activity(Activities::ValidateOrder, order,", indent: 3, step: "validate_order" },
  { text: "    start_to_close_timeout: 10, retry_policy: DEFAULT_RETRY)", indent: 3, step: "validate_order" },
  { text: "Workflow.execute_activity(Activities::ValidateStore, order,", indent: 3, step: "validate_store" },
  { text: "    start_to_close_timeout: 10, retry_policy: DEFAULT_RETRY)", indent: 3, step: "validate_store" },
  { text: "", indent: 0, isBlank: true },
  { text: "# Hold payment — register compensation first", indent: 3, isComment: true },
  { text: "compensations << order", indent: 3, step: "authorize_payment" },
  { text: "payment = Workflow.execute_activity(", indent: 3, step: "authorize_payment" },
  { text: "    Activities::AuthorizePayment, order,", indent: 3, step: "authorize_payment" },
  { text: "    start_to_close_timeout: 15, retry_policy: DEFAULT_RETRY)", indent: 3, step: "authorize_payment" },
  { text: "", indent: 0, isBlank: true },
  { text: "Workflow.execute_activity(Activities::ClearCart, order,", indent: 3, step: "clear_cart" },
  { text: "    start_to_close_timeout: 5, retry_policy: DEFAULT_RETRY)", indent: 3, step: "clear_cart" },
  { text: "", indent: 0, isBlank: true },
  { text: "# Submit — retries automatically", indent: 3, isComment: true },
  { text: "Workflow.execute_activity(Activities::SubmitToStore, order,", indent: 3, step: "submit_to_store" },
  { text: "    start_to_close_timeout: 10,", indent: 3, step: "submit_to_store" },
  { text: "    retry_policy: RetryPolicy.new(max_attempts: 10))", indent: 3, step: "submit_to_store" },
  { text: "", indent: 0, isBlank: true },
  { text: "# Wait for signal — human in the loop", indent: 3, isComment: true },
  { text: "Workflow.wait_condition { @order_ready }", indent: 3, step: "order_ready" },
  { text: "", indent: 0, isBlank: true },
  { text: "# Capture only after confirmation", indent: 3, isComment: true },
  { text: "Workflow.execute_activity(Activities::CapturePayment,", indent: 3, step: "capture_payment" },
  { text: "    order.merge('authorization_id' => authorization_id),", indent: 3, step: "capture_payment" },
  { text: "    start_to_close_timeout: 15, retry_policy: DEFAULT_RETRY)", indent: 3, step: "capture_payment" },
];

const rubyCompensation: CodeLine[] = [
  { text: "", indent: 0, isBlank: true },
  { text: "# Saga: run compensations in reverse", indent: 2, isComment: true },
  { text: "rescue Temporalio::Error::Failure => e", indent: 2 },
  { text: "# A new Cancellation detaches them from cancellation", indent: 3, isComment: true },
  { text: "detached = Temporalio::Cancellation.new", indent: 3, step: "release_payment_hold" },
  { text: "compensations.reverse_each do |input|", indent: 3, step: "release_payment_hold" },
  { text: "Workflow.execute_activity(Activities::ReleasePaymentHold, input,", indent: 4, step: "release_payment_hold" },
  { text: "    start_to_close_timeout: 10, cancellation: detached)", indent: 4, step: "release_payment_hold" },
  { text: "end", indent: 3 },
  { text: "end", indent: 2 },
  { text: "end", indent: 1 },
  { text: "end", indent: 0 },
];

const rubyHighlighting = [
  {
    pattern: /\b(class|def|end|begin|rescue|do)\b/g,
    className: "k",
  },
  {
    pattern: /\b(Temporalio|Workflow|Definition|Activities|RetryPolicy|Cancellation|Error|Failure)\b/g,
    className: "t",
  },
  {
    pattern:
      /\b(execute_activity|wait_condition|workflow_name|workflow_signal|reverse_each|merge|execute|order_ready)\b/g,
    className: "f",
  },
  { pattern: /'[^']*'/g, className: "s" },
  { pattern: /@\w+/g, className: "f" },
  { pattern: /\b(\d+)\b/g, className: "t" },
  { pattern: /\b(true|false|nil)\b/g, className: "t" },
];

// ─── Registry ────────────────────────────────────────────────────

export const WORKFLOW_LANGUAGES: LanguageDef[] = [
  {
    id: "python",
    label: "Python",
    filename: "order_workflow.py",
    code: pythonCode,
    compensation: pythonCompensation,
    highlighting: pythonHighlighting,
  },
  {
    id: "go",
    label: "Go",
    filename: "order_workflow.go",
    code: goCode,
    compensation: goCompensation,
    highlighting: goHighlighting,
  },
  {
    id: "typescript",
    label: "TypeScript",
    filename: "workflows.ts",
    code: typescriptCode,
    compensation: typescriptCompensation,
    highlighting: typescriptHighlighting,
  },
  {
    id: "java",
    label: "Java",
    filename: "OrderWorkflowImpl.java",
    code: javaCode,
    compensation: javaCompensation,
    highlighting: javaHighlighting,
  },
  {
    id: "dotnet",
    label: "C# (.NET)",
    filename: "OrderWorkflow.cs",
    code: dotnetCode,
    compensation: dotnetCompensation,
    highlighting: dotnetHighlighting,
  },
  {
    id: "rust",
    label: "Rust",
    filename: "order_workflow.rs",
    code: rustCode,
    compensation: rustCompensation,
    highlighting: rustHighlighting,
  },
  {
    id: "php",
    label: "PHP",
    filename: "OrderWorkflow.php",
    code: phpCode,
    compensation: phpCompensation,
    highlighting: phpHighlighting,
  },
  {
    id: "ruby",
    label: "Ruby",
    filename: "order_workflow.rb",
    code: rubyCode,
    compensation: rubyCompensation,
    highlighting: rubyHighlighting,
  },
];

export function getLanguageDef(lang: WorkerLanguage): LanguageDef {
  return WORKFLOW_LANGUAGES.find((l) => l.id === lang) ?? WORKFLOW_LANGUAGES[0];
}
