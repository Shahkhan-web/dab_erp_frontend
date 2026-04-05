import { coerceBooleanProperty } from '@angular/cdk/coercion';

import {
    AfterViewInit,
    Component,
    inject,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    SimpleChanges,
    ViewEncapsulation,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FuseLoadingService } from '@fuse/services/loading';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'fuse-loading-bar',
    templateUrl: './loading-bar.component.html',
    styleUrls: ['./loading-bar.component.scss'],
    encapsulation: ViewEncapsulation.None,
    exportAs: 'fuseLoadingBar',
    imports: [MatProgressBarModule],
})
export class FuseLoadingBarComponent implements OnChanges, OnInit, OnDestroy, AfterViewInit {
    private _fuseLoadingService = inject(FuseLoadingService);

    @Input() autoMode: boolean = true;
mode: 'determinate' | 'indeterminate' = 'indeterminate';
progress = 0;
show = false;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On changes
     *
     * @param changes
     */
    ngOnChanges(changes: SimpleChanges): void {
        // Auto mode
        if ('autoMode' in changes) {
            // Set the auto mode in the service
            this._fuseLoadingService.setAutoMode(
                coerceBooleanProperty(changes.autoMode.currentValue)
            );
        }
    }

ngAfterViewInit(): void {
    this._fuseLoadingService.mode$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(value => this.mode = value);

    this._fuseLoadingService.progress$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(value => this.progress = value);

    this._fuseLoadingService.show$
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(value => this.show = value);
  }

    ngOnInit(): void {
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
