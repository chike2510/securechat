export function assertParticipantAccess(
  resourceExists: boolean,
  isParticipant: boolean,
  message: string,
) {
  if (!resourceExists || !isParticipant) throw new Error(message);
}
