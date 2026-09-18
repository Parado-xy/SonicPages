import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders an accessible native button", () => {
    render(<Button>Upload document</Button>);
    expect(screen.getByRole("button", { name: "Upload document" })).toBeEnabled();
  });

  it("supports disabled foundation actions", () => {
    render(<Button disabled>Coming soon</Button>);
    expect(screen.getByRole("button", { name: "Coming soon" })).toBeDisabled();
  });
});
