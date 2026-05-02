import { useEffect, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface ReactQuillWrapperProps {
  value: string;
  onChange: (value: string) => void;
  theme?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Wrapper component for ReactQuill that suppresses findDOMNode warnings in StrictMode.
 * ReactQuill 2.0.0 still uses findDOMNode internally, which triggers warnings in React 18 StrictMode.
 * This wrapper provides a clean interface while the library maintainers work on a fix.
 */
export function ReactQuillWrapper({ 
  value, 
  onChange, 
  theme = "snow", 
  placeholder,
  className 
}: ReactQuillWrapperProps) {
  const quillRef = useRef<ReactQuill>(null);

  // Suppress findDOMNode warnings for ReactQuill
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: any[]) => {
      if (
        typeof args[0] === 'string' &&
        args[0].includes('findDOMNode')
      ) {
        return;
      }
      originalError.call(console, ...args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  return (
    <ReactQuill
      ref={quillRef}
      theme={theme}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  );
}
