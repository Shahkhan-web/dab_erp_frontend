import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  Renderer2
} from '@angular/core';

@Directive({
  selector: '[overlayLoader]',
  standalone: true
})
export class OverlayLoaderDirective implements OnChanges {

  @Input('overlayLoader') loading = false;

  private overlay!: HTMLElement;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {
    this.ensureRelative();
    this.createOverlay();
  }

  ngOnChanges(): void {
    if (this.loading) {
      this.show();
    } else {
      this.hide();
    }
  }

  private ensureRelative(): void {
    const position = getComputedStyle(this.el.nativeElement).position;
    if (position === 'static') {
      this.renderer.setStyle(this.el.nativeElement, 'position', 'relative');
    }
  }

  private createOverlay(): void {
    this.overlay = this.renderer.createElement('div');
    this.renderer.addClass(this.overlay, 'overlay-loader');

    const spinner = this.renderer.createElement('div');
    this.renderer.addClass(spinner, 'overlay-spinner');

    this.renderer.appendChild(this.overlay, spinner);
    this.renderer.appendChild(this.el.nativeElement, this.overlay);

    this.hide();
  }

  private show(): void {
    this.renderer.setStyle(this.overlay, 'display', 'flex');
  }

  private hide(): void {
    this.renderer.setStyle(this.overlay, 'display', 'none');
  }
}
