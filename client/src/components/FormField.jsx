export default function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = false,
  as = "input",
  options = [],
  placeholder,
  disabled = false,
}) {
  const shared = {
    id: name,
    name,
    value,
    onChange,
    required,
    disabled,
    placeholder,
    className:
      "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 disabled:bg-slate-100",
  };

  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={name}>
      {label}
      {as === "select" ? (
        <select {...shared}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : as === "textarea" ? (
        <textarea {...shared} rows={4} />
      ) : (
        <input {...shared} type={type} />
      )}
    </label>
  );
}
