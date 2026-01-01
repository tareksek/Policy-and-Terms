import { deleteRecord, ActionOptions } from "gadget-server";
import { preventCrossUserDataAccess } from "gadget-server/auth";

/** @type { ActionRun } */
export const run = async ({ params, record, logger, api, connections }) => {
  await preventCrossUserDataAccess(params, record);
  await deleteRecord(record);
};

/** @type { ActionOptions } */
export const options = {
  actionType: "delete",
};