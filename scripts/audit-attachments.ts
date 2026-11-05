import nextEnv from "@next/env";
import { auditAttachments } from "../src/server/attachments";
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const result = auditAttachments();
console.log(JSON.stringify(result, null, 2));
if (result.missing.length || result.mismatched.length || result.orphaned.length) process.exitCode = 1;
