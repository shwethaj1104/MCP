import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WorkflowProgress } from "./WorkflowProgress";
// Replace the current AI-stage label with failure without adding a seventh step.
it("marks the existing AI slot as failed and never claims it is running", () => {
  const html = renderToStaticMarkup(
    <WorkflowProgress
      item={{
        status: "AI Review Failed",
        processing_state: "failed",
        error: "Test failure",
      }}
    />,
  );
  expect(html).toContain("AI Review Failed");
  expect(html).not.toContain("AI Review in Progress");
  expect(html.match(/role="listitem"/g)).toHaveLength(6);
  expect(html).toContain("stage-failed");
});
