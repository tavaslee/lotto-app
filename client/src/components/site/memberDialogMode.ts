export type MemberDialogInitialMode = "login" | "register";

export function nextRegisterModeOnDialogChange({
  open,
  hasMemberSession,
  initialMode,
  currentMode,
}: {
  open: boolean;
  hasMemberSession: boolean;
  initialMode: MemberDialogInitialMode;
  currentMode: boolean;
}) {
  if (!open || hasMemberSession) return currentMode;
  return initialMode === "register";
}
