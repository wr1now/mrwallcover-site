import type { ButtonHTMLAttributes, ReactNode } from 'react';
/** React companion to Action.astro: same semantics and shared visual-system CSS. */
export default function Action({ variant = 'secondary', children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet'; children: ReactNode }) {
  return <button type="button" className={`mw-action mw-action--${variant} ${className}`} {...props}><span>{children}</span></button>;
}
