import { describe, expect, it } from "vitest";
import { advanceMessageStatus, notificationFor } from "../shared/message-lifecycle";

describe("SecureChat message lifecycle", () => {
  it("advances from sent to delivered to read without regression", () => {
    expect(advanceMessageStatus("sent", "delivered")).toBe("delivered");
    expect(advanceMessageStatus("delivered", "read")).toBe("read");
    expect(advanceMessageStatus("read", "sent")).toBe("read");
  });

  it("creates the correct in-app notification categories", () => {
    expect(notificationFor("new-message")).toEqual({ type: "new_message", title: "New encrypted message" });
    expect(notificationFor("recipient-returned")).toEqual({ type: "recipient_returned", title: "Contact is back online" });
  });
});
