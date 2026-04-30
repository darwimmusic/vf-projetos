import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, helperText, id, className, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hasError = Boolean(error)

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wide text-muted"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={hasError}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined}
        className={cn(
          'h-12 rounded-xl border bg-sunken px-4 text-base text-onyx outline-none transition-colors',
          'placeholder:text-muted/60',
          'focus:border-onyx focus:bg-elevated',
          'disabled:cursor-not-allowed disabled:opacity-50',
          hasError ? 'border-danger' : 'border-transparent',
          className,
        )}
        {...rest}
      />
      {error && (
        <span id={`${inputId}-error`} className="text-xs text-danger">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${inputId}-help`} className="text-xs text-muted">
          {helperText}
        </span>
      )}
    </div>
  )
})
