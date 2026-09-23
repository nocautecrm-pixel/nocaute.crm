// Use the existing Nocaute login for this process without changing another
// project's active GitHub account. Never print or persist the credential.
import { spawnSync } from "node:child_process";
const auth = spawnSync("gh", ["auth","token","--hostname","github.com","--user","nocautecrm-pixel"], { encoding: "utf8" });
if (auth.status !== 0 || !auth.stdout.trim()) {
  console.error("Existing GitHub login for nocautecrm-pixel is unavailable."); process.exit(1);
}
const env = { ...process.env, GH_TOKEN: auth.stdout.trim() };
let command = "gh", args = process.argv.slice(2);
if (args[0] === "git") {
  command = "git"; args = args.slice(1);
  env.GIT_CONFIG_COUNT = "2";
  env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
  env.GIT_CONFIG_VALUE_0 = "AUTHORIZATION: basic " + Buffer.from("x-access-token:" + env.GH_TOKEN).toString("base64");
  env.GIT_CONFIG_KEY_1 = "credential.helper"; env.GIT_CONFIG_VALUE_1 = "";
}
const result = spawnSync(command,args,{env,stdio:"inherit",shell:false});
process.exit(result.status ?? 1);
