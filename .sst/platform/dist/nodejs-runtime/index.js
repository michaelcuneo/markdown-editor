// functions/nodejs-runtime/index.ts
import path from "node:path";
import fs from "node:fs";
import url from "node:url";
import http from "node:http";
import { Writable } from "node:stream";
var handler = process.argv[2];
var AWS_LAMBDA_RUNTIME_API = `http://` + process.env.AWS_LAMBDA_RUNTIME_API + "/2018-06-01";
var parsed = path.parse(handler);
var file = [".js", ".jsx", ".mjs", ".cjs"].map((ext) => path.join(parsed.dir, parsed.name + ext)).find((file2) => {
  return fs.existsSync(file2);
});
var STREAMING_SYMBOL = Symbol.for("aws.lambda.streaming");
var awslambda = {
  streamifyResponse(handler2) {
    handler2[STREAMING_SYMBOL] = true;
    return handler2;
  },
  HttpResponseStream: {
    from(responseStream, metadata) {
      responseStream._preludeWritten = true;
      if (responseStream._contentType && metadata) {
        metadata.headers = metadata.headers || {};
        metadata.headers["Content-Type"] = metadata.headers["Content-Type"] || responseStream._contentType;
      }
      const prelude = JSON.stringify(metadata);
      responseStream.write(prelude);
      responseStream.write(new Uint8Array(8));
      return responseStream;
    }
  }
};
global.awslambda = awslambda;
var fn;
var request;
var response;
var context;
async function error(ex) {
  const errorType = ex instanceof Error ? ex.name : "Error";
  const errorMessage = ex instanceof Error ? ex.message : String(ex);
  const trace = ex instanceof Error ? ex.stack?.split(`
`) : undefined;
  const body = JSON.stringify({
    errorType,
    errorMessage,
    trace
  });
  await fetch(AWS_LAMBDA_RUNTIME_API + (!context ? `/runtime/init/error` : `/runtime/invocation/${context.awsRequestId}/error`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body
  });
}
process.on("unhandledRejection", error);
process.on("uncaughtException", error);
try {
  const { href } = url.pathToFileURL(file);
  const mod = await import(href);
  const handler2 = parsed.ext.substring(1);
  fn = mod[handler2];
  if (!fn) {
    throw new Error(`Function "${handler2}" not found in "${handler2}". Found ${Object.keys(mod).join(", ")}`);
  }
} catch (ex) {
  await error(ex);
  process.exit(1);
}
while (true) {
  const timeout = setTimeout(() => {
    process.exit(0);
  }, 60000);
  try {
    const result = await fetch(AWS_LAMBDA_RUNTIME_API + `/runtime/invocation/next`);
    clearTimeout(timeout);
    context = {
      awsRequestId: result.headers.get("lambda-runtime-aws-request-id") || "",
      invokedFunctionArn: result.headers.get("lambda-runtime-invoked-function-arn") || "",
      getRemainingTimeInMillis: () => Math.max(Number(result.headers.get("lambda-runtime-deadline-ms")) - Date.now(), 0),
      identity: (() => {
        const header = result.headers.get("lambda-runtime-cognito-identity");
        return header ? JSON.parse(header) : undefined;
      })(),
      clientContext: (() => {
        const header = result.headers.get("lambda-runtime-client-context");
        return header ? JSON.parse(header) : undefined;
      })(),
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
      memoryLimitInMB: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
      logGroupName: result.headers.get("lambda-runtime-log-group-name") || "",
      logStreamName: result.headers.get("lambda-runtime-log-stream-name") || "",
      callbackWaitsForEmptyEventLoop: {
        set value(_value) {
          throw new Error("`callbackWaitsForEmptyEventLoop` on lambda Context is not implemented by SST Live Lambda Development.");
        },
        get value() {
          return true;
        }
      }.value,
      done() {
        throw new Error("`done` on lambda Context is not implemented by SST Live Lambda Development.");
      },
      fail() {
        throw new Error("`fail` on lambda Context is not implemented by SST Live Lambda Development.");
      },
      succeed() {
        throw new Error("`succeed` on lambda Context is not implemented by SST Live Lambda Development.");
      }
    };
    request = await result.json();
  } catch (ex) {
    if (ex.code === "UND_ERR_HEADERS_TIMEOUT")
      continue;
    await error(ex);
    continue;
  }
  global[Symbol.for("aws.lambda.runtime.requestId")] = context.awsRequestId;
  const isStreaming = fn[STREAMING_SYMBOL] === true;
  if (isStreaming) {
    try {
      const req = http.request(`http://${process.env.AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime/invocation/${context.awsRequestId}/response`, {
        method: "POST",
        headers: {
          "Transfer-Encoding": "chunked",
          "Content-Type": "application/vnd.awslambda.http-integration-response",
          "Lambda-Runtime-Function-Response-Mode": "streaming"
        }
      });
      const responseStream = new Writable({
        write(chunk, encoding, cb) {
          if (!responseStream._preludeWritten) {
            responseStream._preludeWritten = true;
            const metadata = JSON.stringify({
              statusCode: 200,
              headers: {
                "Content-Type": responseStream._contentType || "application/octet-stream"
              }
            });
            req.write(metadata);
            req.write(Buffer.alloc(8));
          }
          req.write(chunk, encoding, cb);
        },
        final(cb) {
          req.end(cb);
        }
      });
      responseStream._preludeWritten = false;
      responseStream.setContentType = (type) => {
        responseStream._contentType = type;
      };
      await new Promise((resolve, reject) => {
        req.on("error", reject);
        req.on("response", () => resolve());
        fn(request, responseStream, context).then(() => {
          if (!responseStream.writableEnded) {
            responseStream.end();
          }
        }).catch(async (ex) => {
          if (!responseStream.writableEnded) {
            responseStream.end();
          }
          reject(ex);
        });
      });
    } catch (ex) {
      await error(ex);
    }
  } else {
    try {
      response = await fn(request, context);
    } catch (ex) {
      await error(ex);
      continue;
    }
    while (true) {
      try {
        await fetch(AWS_LAMBDA_RUNTIME_API + `/runtime/invocation/${context.awsRequestId}/response`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(response)
        });
        break;
      } catch (ex) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
}
