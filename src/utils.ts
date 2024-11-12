import {
  getDestination,
  HttpDestination,
  HttpDestinationOrFetchOptions,
} from "@sap-cloud-sdk/connectivity";
import { HttpResponse } from "@sap-cloud-sdk/http-client";
import cds from "@sap/cds";
import { Readable, PassThrough } from "stream";
import {
  ExternalServiceConfig,
  MediaReadResult,
  UnknownObjectMap,
} from "./types";

const ERR_NO_CONFIG = "Failed to find requested external service in config";
const ERR_INVALID_LOCAL_AUTH = "Unsupported local authentication style";
const ERR_NO_VALID_URL = "Invalid URL provided in service config";
const BASIC_AUTH = "BasicAuthentication";

/**
 * Retrieves the destination credentials from either local config or remote destination based on configuration.
 *
 * @param externalService string - External service key name as found in package.json
 * @returns HttpDestinationOrFetchOptions
 */
export async function getDestinationInformation(
  externalService: string
): Promise<HttpDestinationOrFetchOptions> {
  const dependencies = cds.env.requires as UnknownObjectMap;
  const extCfg = dependencies[externalService] as ExternalServiceConfig;

  if (!extCfg) {
    throw new Error(ERR_NO_CONFIG);
  }

  if (extCfg.credentials?.destination) {
    return await loadRemoteDestination(extCfg.credentials.destination);
  } else if (extCfg?.credentials?.authentication !== BASIC_AUTH) {
    throw new Error(ERR_INVALID_LOCAL_AUTH);
  } else if (!extCfg?.credentials.url) {
    throw new Error(ERR_NO_VALID_URL);
  }

  return {
    url: extCfg.credentials.url,
    authentication: BASIC_AUTH,
    username: extCfg.credentials.username,
    password: extCfg.credentials.password,
  };
}

/**
 * Loads the external service destination from BTP Destination Service.
 * This is done using the '@sap-cloud-sdk/connectivity' module.
 *
 * @param destination string - Destination name as configured on BTP
 * @returns HttpDestination
 */
async function loadRemoteDestination(
  destination: string
): Promise<HttpDestination> {
  const remoteDestination = await getDestination({
    destinationName: destination,
  });

  return remoteDestination as HttpDestination;
}

/**
 * Formats a base64 media result for streaming to client
 * @param data Uint8Array|Buffer - Buffer containing base64 encrypted media
 * @returns Array of formatted media
 */
export function formatMediaResult(
  data: Uint8Array | Buffer,
  mimetype: string
): MediaReadResult {
  const stream = new Readable();
  stream.push(data);
  stream.push(null);
  return {
    value: stream,
    $mediaContentType: mimetype,
  };
}

export async function processHttpPassthrough(
  httpResponse: HttpResponse
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const stream = new PassThrough();
    const chunks: Uint8Array[] = [];

    stream.on("data", (chunk: Uint8Array) => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      const buf = Buffer.concat(chunks);
      resolve(buf);
    });

    stream.on("error", () => {
      reject();
    });

    httpResponse.data.pipe(stream);
  });
}
