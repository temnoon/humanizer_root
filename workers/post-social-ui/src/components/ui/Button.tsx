/**
 * Button Component
 */

import { Component, JSX, splitProps } from 'solid-js';

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
}

export const Button: Component<ButtonProps> = (props) => {
  const [local, others] = splitProps(props, ['variant', 'loading', 'children', 'class']);
  
  const variant = local.variant || 'primary';
  const className = `btn btn-${variant} ${local.class || ''}`;

  return (
    <button
      class={className}
      disabled={local.loading || others.disabled}
      {...others}
    >
      {local.loading ? (
        <>
          <span class="spinner"></span>
          {local.children}
        </>
      ) : (
        local.children
      )}
    </button>
  );
};
