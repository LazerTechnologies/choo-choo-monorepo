import '@/lib/sanitize-logging';

import { NextResponse } from 'next/server';

export type ApiHandler = (request: Request) => Promise<Response>;

/**
 * Middleware to protect internal API routes with secret authentication
 */
export function withInternalAuth(handler: ApiHandler): ApiHandler {
  return async (request: Request) => {
    const secret = request.headers.get('x-internal-secret');
    const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

    if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return handler(request);
  };
}

/**
 * Middleware to add request logging and error handling
 */
export function withLogging(handler: ApiHandler, routeName: string): ApiHandler {
  return async (request: Request) => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    console.log(`🚀 [${timestamp}] ${routeName}: Starting request`);

    try {
      const response = await handler(request);
      const endTime = Date.now();
      console.log(`✅ [${timestamp}] ${routeName}: Completed in ${endTime - startTime}ms`);
      return response;
    } catch (error) {
      const endTime = Date.now();
      console.error(`❌ [${timestamp}] ${routeName}: Failed in ${endTime - startTime}ms`, error);

      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }
  };
}

/**
 * Combine multiple middleware functions
 */
export function withMiddleware(...middlewares: Array<(handler: ApiHandler) => ApiHandler>) {
  return (handler: ApiHandler): ApiHandler => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}
