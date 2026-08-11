import type { TraceoNestOptions } from './traceo.interceptor';
import { TraceoInterceptor } from './traceo.interceptor';

export interface DynamicModuleLike {
  module: unknown;
  providers?: unknown[];
  exports?: unknown[];
  global?: boolean;
}

export class TraceoModule {
  public static forRoot(options: TraceoNestOptions): DynamicModuleLike {
    const interceptorProvider = {
      provide: 'APP_INTERCEPTOR',
      useValue: new TraceoInterceptor(options)
    };

    const optionsProvider = {
      provide: 'TRACEO_NEST_OPTIONS',
      useValue: options
    };

    return {
      module: TraceoModule,
      providers: [optionsProvider, interceptorProvider],
      exports: [optionsProvider, interceptorProvider],
      global: true
    };
  }
}
