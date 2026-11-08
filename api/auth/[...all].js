import { auth } from "../../lib/auth.js";

const handler = (request) => auth.handler(request);

export const GET = handler;
export const POST = handler;
