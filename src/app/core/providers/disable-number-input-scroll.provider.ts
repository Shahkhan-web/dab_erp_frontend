import { EnvironmentProviders, provideAppInitializer } from '@angular/core';

/**
 * Prevents mouse-wheel from changing the value of focused number inputs.
 */
export const provideDisableNumberInputScroll = (): EnvironmentProviders =>
    provideAppInitializer(() => {
        document.addEventListener(
            'wheel',
            (event: WheelEvent) => {
                const target = event.target;
                if (
                    target instanceof HTMLInputElement &&
                    target.type === 'number' &&
                    document.activeElement === target
                ) {
                    event.preventDefault();
                }
            },
            { passive: false }
        );
    });
