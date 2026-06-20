/** Debounced filter apply — text inputs use `schedule`, selects/dates use `now`. */
export function createDebouncedFilterApply(run: () => void, ms = 350): {
    schedule: () => void;
    now: () => void;
    cancel: () => void;
} {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cancel = (): void => {
        if (timer) clearTimeout(timer);
        timer = null;
    };

    const now = (): void => {
        cancel();
        run();
    };

    const schedule = (): void => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            run();
        }, ms);
    };

    return { schedule, now, cancel };
}
