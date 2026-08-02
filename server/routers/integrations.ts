import { router } from "../_core/trpc";
import { adminMemberProcedure } from "../procedures";
import { getGoogleSheetsHealth } from "../services/googleSheets";

export const integrationsRouter = router({
  googleSheetsHealth: adminMemberProcedure.query(() => getGoogleSheetsHealth()),
});
