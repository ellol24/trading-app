const { execSync } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function run(cmd) {
  try {
    return execSync(cmd, { stdio: "inherit" });
  } catch (err) {
    console.error(`\n❌ Error running: ${cmd}`);
    process.exit(1);
  }
}

function runSilent(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

console.log("\n========================================================");
console.log("   🚀 XSPY TRADER — Smart GitHub Deployment Hub        ");
console.log("========================================================\n");

// Check git status
const status = runSilent("git status --porcelain");
if (status) {
  console.log("📝 Uncommitted changes detected:\n" + status + "\n");
  rl.question("Enter commit message (or press ENTER for auto message): ", (msg) => {
    const commitMsg = msg.trim() || `update: platform sync ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
    console.log(`\n📦 Staging and committing changes: "${commitMsg}"...`);
    run("git add -A");
    run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    askTarget();
  });
} else {
  console.log("✅ Working directory clean (no uncommitted changes).\n");
  askTarget();
}

function askTarget() {
  console.log("Select where you want to upload / push your code:\n");
  console.log("  [1] 🌐 Production: ellol24/trading-app (ينشر مباشرة على الموقع الحي www.xspy-trader.com)");
  console.log("  [2] 👤 Personal:   Ali-mahmoud830/trading-app (المستودع الشخصي كنسخة احتياطية)");
  console.log("  [3] ⚡ Both:       كلا الحسابين معاً في نفس الوقت (موصى به - تحديث متزامن)\n");

  rl.question("👉 Choose an option (1, 2, or 3) [Default: 3]: ", (choice) => {
    const selected = choice.trim() || "3";
    console.log("\n--------------------------------------------------------");

    if (selected === "1") {
      console.log("🚀 Pushing to Production (ellol24/trading-app)...");
      run("git push origin main");
      console.log("\n🎉 Successfully deployed to ellol24! Vercel is building the live site.");
    } else if (selected === "2") {
      console.log("🚀 Pushing to Personal Backup (Ali-mahmoud830/trading-app)...");
      run("git push ali main");
      console.log("\n🎉 Successfully updated Ali-mahmoud830/trading-app!");
    } else {
      console.log("🚀 Pushing to BOTH accounts simultaneously (ellol24 + Ali-mahmoud830)...");
      run("git push all main");
      console.log("\n🎉 Both repositories are 100% updated and in sync!");
    }

    console.log("========================================================\n");
    rl.close();
  });
}
