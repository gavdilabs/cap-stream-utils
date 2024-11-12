import {
  executeHttpRequest,
  HttpRequestConfig,
  HttpResponse,
} from "@sap-cloud-sdk/http-client";
import { MediaReadResult } from "./types";
import {
  formatMediaResult,
  getDestinationInformation,
  processHttpPassthrough,
} from "./utils";
import { Request } from "@sap/cds";

// HTTP Methods
const STREAM_HTTP_SEND_METHOD = "PUT";
const STREAM_HTTP_FETCH_METHOD = "GET";

// HTTP Header Keys
const CONTENT_DISPOSITION = "Content-Disposition";
const OUTBOUND_CONTENT_TYPE = "Content-Type";
const INBOUND_CONTENT_TYPE = "content-type";

// ERRORS
const ERR_FETCH_FAILED = "Failed to handle proxy stream to remote service";
const ERR_SEND_FAILED = "Failed to stream data to remote service";
const ERR_STREAM_REJECTED = "External service rejected the incoming stream";
const ERR_DESTINATION_RETRIEVAL =
  "Failed to find destination information to send request";

// Other
const STREAM_RESPONSE_TYPE = "stream";

/**
 * Custom implementation of the SAP CAP HTTP Client, as supported by their Cloud SDK.
 * Takes in the target URI endpoint, the name of the remote service binding and the request object,
 * to perform a custom octet-stream transaction from remote service and integrates it as a proxy pipe.
 *
 * For more info see the following:
 * Cloud SDK: https://sap.github.io/cloud-sdk/docs/js/features/connectivity/http-client
 * Custom streaming: https://community.sap.com/t5/technology-q-a/getting-stream-data-using-cds-remoteservice-in-cap/qaq-p/13862522
 *
 * @param string uri - URI address for target entity, e.g. "/Entity(key)/file"
 * @param string externalService - Name of the external service binding as seen in package.json
 * @param req Request - The transaction request object received in service handler
 * @returns Request
 */
export async function streamMediaFromRemoteServiceDirectProxy(
  uri: string,
  externalService: string,
  req: Request
): Promise<Request> {
  const response = await streamMediaFromRemote(uri, externalService);

  // Proxy the stream directly to the request response from this service
  (req as { [key: string]: any }).res.setHeader(
    OUTBOUND_CONTENT_TYPE,
    response.headers[INBOUND_CONTENT_TYPE]
  );

  response.data.pipe((req as { [key: string]: any }).res);
  return req;
}

/**
 * Custom implementation of the SAP CAP HTTP Client, as supported by their Cloud SDK.
 * Takes in the target URI endpoint, the name of the remote service binding and the request object,
 * to perform a custom octet-stream transaction from remote service and integrates it as a proxy pipe.
 *
 * For more info see the following:
 * Cloud SDK: https://sap.github.io/cloud-sdk/docs/js/features/connectivity/http-client
 * Custom streaming: https://community.sap.com/t5/technology-q-a/getting-stream-data-using-cds-remoteservice-in-cap/qaq-p/13862522
 *
 * @param string uri - URI address for target entity, e.g. "/Entity(key)/file"
 * @param string externalService - Name of the external service binding as seen in package.json
 * @param req Request - The transaction request object received in service handler
 * @returns Request
 */
export async function streamMediaFromRemoteThroughPipe(
  uri: string,
  externalService: string,
  req: Request,
  filename?: string
): Promise<Request> {
  const response = await streamMediaFromRemote(uri, externalService);
  await processHttpPassthrough(response);

  // We pipe in the new buffer
  (req as { [key: string]: any }).res.setHeader(
    OUTBOUND_CONTENT_TYPE,
    response.headers[INBOUND_CONTENT_TYPE]
  );
  if (filename) {
    (req as { [key: string]: any }).res.setHeader(
      CONTENT_DISPOSITION,
      `filename=${filename}`
    );
  }

  response.data.pipe((req as { [key: string]: any }).res);
  return req;
}

/**
 * Custom implementation of the SAP CAP HTTP Client, as supported by their Cloud SDK.
 * Takes in the target URI endpoint, the name of the remote service binding and the request object,
 * to perform a custom octet-stream transaction from remote service and integrates it as a proxy pipe.
 *
 * For more info see the following:
 * Cloud SDK: https://sap.github.io/cloud-sdk/docs/js/features/connectivity/http-client
 * Custom streaming: https://community.sap.com/t5/technology-q-a/getting-stream-data-using-cds-remoteservice-in-cap/qaq-p/13862522
 *
 * @param string uri - URI address for target entity, e.g. "/Entity(key)/file"
 * @param string externalService - Name of the external service binding as seen in package.json
 * @returns Buffer
 */
export async function streamMediaFromRemoteServiceToBuffer(
  uri: string,
  externalService: string
): Promise<Buffer> {
  const response = await streamMediaFromRemote(uri, externalService);
  return await processHttpPassthrough(response);
}

/**
 * Custom implementation of the SAP CAP HTTP Client, as supported by their Cloud SDK.
 * Takes in the target URI endpoint, the name of the remote service binding and the request object,
 * to perform a custom octet-stream transaction from remote service and integrates it as a proxy pipe.
 *
 * For more info see the following:
 * Cloud SDK: https://sap.github.io/cloud-sdk/docs/js/features/connectivity/http-client
 * Custom streaming: https://community.sap.com/t5/technology-q-a/getting-stream-data-using-cds-remoteservice-in-cap/qaq-p/13862522
 *
 * @param string uri - URI address for target entity, e.g. "/Entity(key)/file"
 * @param string externalService - Name of the external service binding as seen in package.json
 * @returns MediaReadResult
 */
export async function streamMediaFromRemoteToMediaReadResult(
  uri: string,
  externalService: string
): Promise<MediaReadResult> {
  const response = await streamMediaFromRemote(uri, externalService);
  const buf = await processHttpPassthrough(response);

  return formatMediaResult(buf, response.headers[INBOUND_CONTENT_TYPE]);
}

/**
 * Custom implementation of the SAP CAP HTTP Client, as supported by their Cloud SDK.
 * Takes in the target URI endpoint, the name of the remote service binding and the request object,
 * to perform a custom octet-stream transaction from remote service and integrates it as a proxy pipe.
 *
 * For more info see the following:
 * Cloud SDK: https://sap.github.io/cloud-sdk/docs/js/features/connectivity/http-client
 * Custom streaming: https://community.sap.com/t5/technology-q-a/getting-stream-data-using-cds-remoteservice-in-cap/qaq-p/13862522
 *
 * @param string uri - URI address for target entity, e.g. "/Entity(key)/file"
 * @param string externalService - Name of the external service binding as seen in package.json
 * @returns HttpResponse
 */
export async function streamMediaFromRemote(
  uri: string,
  externalService: string
): Promise<HttpResponse> {
  const destinationInfo = await getDestinationInformation(
    externalService
  ).catch(() => {
    throw new Error(ERR_DESTINATION_RETRIEVAL);
  });

  const requestConfig = {
    method: STREAM_HTTP_FETCH_METHOD,
    url: uri,
    responseType: STREAM_RESPONSE_TYPE,
  };

  return await executeHttpRequest(
    destinationInfo,
    requestConfig as HttpRequestConfig
  ).catch(() => {
    throw new Error(ERR_FETCH_FAILED);
  });
}

/**
 * Custom streaming implementation that utilizes the SAP Cloud SDK to send a buffer to external service through destination.
 * Takes in the target service name as outlined in the package.json and loads in the destination configuration.
 *
 * For more info see the following:
 * Cloud SDK: https://sap.github.io/cloud-sdk/docs/js/features/connectivity/http-client
 * Custom streaming: https://community.sap.com/t5/technology-q-a/getting-stream-data-using-cds-remoteservice-in-cap/qaq-p/13862522
 *
 * @param string uri - URI address for the target entity on the remote service, e.g. "/Entity(key)/file"
 * @param string fileType - The file type of the media file you want to stream, e.g. ".png" or ".pdf"
 * @param Buffer data - The buffer containing the byte data of the media file you wish to send
 * @param string externalService - The external service name as defined in the package.json of your CAP service
 * @returns Promise<void>
 */
export async function streamMediaToRemoteService(
  uri: string,
  fileType: string,
  data: Buffer,
  externalService: string
): Promise<void> {
  const destinationInfo = await getDestinationInformation(
    externalService
  ).catch(() => {
    throw new Error(ERR_DESTINATION_RETRIEVAL);
  });

  const requestConfig = {
    method: STREAM_HTTP_SEND_METHOD,
    url: uri,
    data: data,
    headers: {
      "Content-Type": fileType,
    },
  };

  const response = await executeHttpRequest(
    destinationInfo,
    requestConfig as HttpRequestConfig
  ).catch(() => {
    throw new Error(ERR_SEND_FAILED);
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(ERR_STREAM_REJECTED);
  }
}
