import { auth } from "../lib/auth.js";
import { routeAuthRequest } from "../lib/auth-request.js";

const handler = (request) => auth.handler(routeAuthRequest(request));

export const GET = handler;
export const POST = handler;
