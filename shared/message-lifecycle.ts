export type MessageStatus = "sent" | "delivered" | "read";

const rank: Record<MessageStatus, number> = { sent: 0, delivered: 1, read: 2 };

export function advanceMessageStatus(current: MessageStatus, next: MessageStatus): MessageStatus {
  return rank[next] >= rank[current] ? next : current;
}

export function notificationFor(event: "new-message" | "recipient-returned") {
  return event === "new-message"
    ? { type: "new_message" as const, title: "New encrypted message" }
    : { type: "recipient_returned" as const, title: "Contact is back online" };
}
