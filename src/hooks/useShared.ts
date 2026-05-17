import React, { useState, useMemo } from 'react';

export function useSearch<T>(items: T[], searchFields: (keyof T)[]) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    
    const query = searchQuery.toLowerCase();
    return items.filter((item) =>
      searchFields.some((field) => {
        const value = item[field];
        return value && String(value).toLowerCase().includes(query);
      })
    );
  }, [items, searchQuery, searchFields]);

  return { searchQuery, setSearchQuery, filteredItems };
}

export function useForm<T>(initialState: T) {
  const [values, setValues] = useState<T>(initialState);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const resetForm = () => setValues(initialState);

  return { values, setValues, handleChange, resetForm };
}
