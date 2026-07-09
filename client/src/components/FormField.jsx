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
    className: "flow-input",
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
