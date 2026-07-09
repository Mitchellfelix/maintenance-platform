import { getRoleDescription, getRoleLabel } from "../lib/permissions.js";

const selectClassName =
  "mt-2 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2 disabled:bg-slate-300/50";

export default function RoleSelect({
  label,
  name = "role",
  value,
  onChange,
  roles,
  disabled = false,
  required = false,
  showDescription = true,
  id,
}) {
  const fieldId = id || name;
  const description = showDescription ? getRoleDescription(value) : "";

  const select = (
    <select
      id={fieldId}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      className={label ? selectClassName : selectClassName.replace("mt-2 ", "")}
    >
      {roles.map((role) => (
        <option key={role} value={role}>
          {getRoleLabel(role)}
        </option>
      ))}
    </select>
  );

  if (!label) {
    return (
      <div>
        {select}
        {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      </div>
    );
  }

  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={fieldId}>
      {label}
      {select}
      {description ? <p className="mt-2 text-xs text-slate-500">{description}</p> : null}
    </label>
  );
}
