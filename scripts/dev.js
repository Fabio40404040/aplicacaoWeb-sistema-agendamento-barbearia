import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const npxCommand = isWindows ? "npx.cmd" : "npx";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} terminou com o código ${code}.`));
    });
  });
}

function openBrowser(address) {
  let command;
  let args;

  if (process.platform === "darwin") {
    command = "open";
    args = ["-a", "Google Chrome", address];
  } else if (isWindows) {
    command = "cmd";
    args = ["/c", "start", "", address];
  } else {
    command = "google-chrome";
    args = [address];
  }

  const browser = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  browser.unref();
  console.log(`\nAbrindo ${address} no Google Chrome...\n`);
}

try {
  await run(npmCommand, ["run", "build"]);
  await run(npxCommand, [
    "wrangler",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
  ]);

  const frontendWatcher = spawn(
    npxCommand,
    ["vite", "build", "--watch", "--emptyOutDir=false"],
    { stdio: "inherit" },
  );
  const server = spawn(
    npxCommand,
    ["wrangler", "dev", "--live-reload"],
    { stdio: ["inherit", "pipe", "pipe"] },
  );

  let browserOpened = false;
  let serverOutput = "";
  const forwardOutput = (stream, destination) => {
    stream.on("data", (chunk) => {
      destination.write(chunk);
      if (browserOpened) return;
      const plainText = chunk.toString().replace(/\u001b\[[0-9;]*m/g, "");
      serverOutput = `${serverOutput}${plainText}`.slice(-1000);
      const address = serverOutput.match(/Ready on (https?:\/\/\S+)/)?.[1];
      if (!address) return;
      browserOpened = true;
      openBrowser(address);
    });
  };
  forwardOutput(server.stdout, process.stdout);
  forwardOutput(server.stderr, process.stderr);

  const stopDevelopment = (signal) => {
    frontendWatcher.kill(signal);
    server.kill(signal);
  };
  process.once("SIGINT", () => stopDevelopment("SIGINT"));
  process.once("SIGTERM", () => stopDevelopment("SIGTERM"));
  frontendWatcher.once("error", (error) => {
    console.error("Não foi possível observar o frontend:", error.message);
    server.kill("SIGTERM");
  });
  server.once("error", (error) => {
    console.error("Não foi possível iniciar o servidor:", error.message);
    frontendWatcher.kill("SIGTERM");
    process.exitCode = 1;
  });
  server.once("exit", (code) => {
    frontendWatcher.kill("SIGTERM");
    process.exitCode = code ?? 0;
  });
} catch (error) {
  console.error("\nNão foi possível iniciar o projeto:", error.message);
  process.exitCode = 1;
}
