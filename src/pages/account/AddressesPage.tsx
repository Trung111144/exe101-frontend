import { useState } from 'react';
import { addresses, provinces } from '../../api/endpoints';
import type { AddressDTO, AddressInput } from '../../api/types';
import { Action, Badge, Empty, ErrorBox, Field, Loading, Modal, PageHead, useAsync } from '../../components/ui';

const blank: AddressInput = {
  label: '', recipientName: '', phone: '', line1: '', line2: '', ward: '', district: '', provinceCode: '',
  postalCode: '', countryCode: 'VN', defaultAddress: false,
};

export function AddressesPage() {
  const list = useAsync(() => addresses.list());
  const provinceList = useAsync(() => provinces.supported());
  const [editing, setEditing] = useState<{ id: number | null; value: AddressInput } | null>(null);
  const provinceName = (code: string) => provinceList.data?.find((p) => p.provinceCode === code)?.provinceName ?? code;

  if (list.loading && !list.data) return <Loading />;
  return (
    <div>
      <PageHead title="Sổ địa chỉ" actions={<button className="btn btn-primary" onClick={() => setEditing({ id: null, value: { ...blank, defaultAddress: !list.data?.length } })}>Thêm địa chỉ</button>} />
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.data?.length === 0 && <Empty title="Chưa có địa chỉ nào.">Cần ít nhất một địa chỉ để đặt bản in.</Empty>}
      <div className="card-list">
        {list.data?.map((a: AddressDTO) => (
          <div key={a.addressId} className="panel">
            <div className="row-between">
              <div className="cell-strong">{a.label || a.recipientName}</div>
              {a.defaultAddress && <Badge status="ACTIVE" text="Mặc định" />}
            </div>
            <div>{a.recipientName}, {a.phone}</div>
            <div className="muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.ward}{a.district ? `, ${a.district}` : ''}, {provinceName(a.provinceCode)}</div>
            <div className="row-gap">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: a.addressId, value: { ...a, label: a.label ?? '', line2: a.line2 ?? '', district: a.district ?? '', postalCode: a.postalCode ?? '' } })}>Sửa</button>
              <Action variant="quiet" size="sm" confirm="Xoá địa chỉ này?" onClick={async () => { await addresses.remove(a.addressId); await list.reload(); }}>Xoá</Action>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <AddressForm
          initial={editing.value}
          provinces={provinceList.data ?? []}
          provinceError={provinceList.error}
          onClose={() => setEditing(null)}
          onSave={async (value) => {
            const clean: AddressInput = {
              ...value,
              label: value.label || null, line2: value.line2 || null, district: value.district || null,
              postalCode: value.postalCode || null,
            };
            if (editing.id === null) await addresses.create(clean);
            else await addresses.update(editing.id, clean);
            setEditing(null);
            await list.reload();
          }}
        />
      )}
    </div>
  );
}

// Same rules as the backend's CreateAddressDTO/UpdateAddressDTO, so the person sees which field is wrong instead of
// the backend's generic 400 INVALID_REQUEST.
function addressProblems(value: AddressInput): string[] {
  const problems: string[] = [];
  const t = (text: string | null | undefined) => (text ?? '').trim();
  if (!t(value.recipientName)) problems.push('Người nhận: không được để trống.');
  if (!/^0\d{9}$/.test(t(value.phone))) problems.push('Số điện thoại: đúng 10 chữ số, bắt đầu bằng 0.');
  if (!t(value.provinceCode)) problems.push('Tỉnh/thành: hãy chọn một tỉnh/thành.');
  if (!t(value.line1)) problems.push('Địa chỉ: không được để trống.');
  if (!t(value.ward)) problems.push('Phường/xã: không được để trống.');
  if (t(value.postalCode) && !/^\d{5}$/.test(t(value.postalCode))) problems.push('Mã bưu chính: đúng 5 chữ số, hoặc để trống.');
  return problems;
}

function AddressForm({ initial, provinces: options, provinceError, onClose, onSave }: {
  initial: AddressInput; provinces: { provinceCode: string; provinceName: string }[]; provinceError: unknown;
  onClose: () => void; onSave: (value: AddressInput) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<unknown>(null);
  const set = (key: keyof AddressInput) => (event: { target: { value: string } }) => setValue({ ...value, [key]: event.target.value });
  return (
    <Modal title="Địa chỉ giao hàng" onClose={onClose}>
      <form className="form grid-2" onSubmit={(event) => event.preventDefault()}>
        <Field label="Tên gợi nhớ"><input className="input" maxLength={80} placeholder="Nhà, công ty…" value={value.label ?? ''} onChange={set('label')} /></Field>
        <Field label="Người nhận"><input className="input" required maxLength={160} value={value.recipientName} onChange={set('recipientName')} /></Field>
        <Field label="Số điện thoại" hint="10 số, bắt đầu bằng 0"><input className="input" required pattern="0\d{9}" value={value.phone} onChange={set('phone')} /></Field>
        <Field label="Tỉnh/thành">
          <select className="input" required value={value.provinceCode} onChange={set('provinceCode')}>
            <option value="">Chọn tỉnh/thành</option>
            {options.map((p) => <option key={p.provinceCode} value={p.provinceCode}>{p.provinceName}</option>)}
          </select>
        </Field>
        <Field label="Địa chỉ"><input className="input" required maxLength={240} value={value.line1} onChange={set('line1')} /></Field>
        <Field label="Địa chỉ bổ sung"><input className="input" maxLength={240} value={value.line2 ?? ''} onChange={set('line2')} /></Field>
        <Field label="Phường/xã"><input className="input" required maxLength={160} value={value.ward} onChange={set('ward')} /></Field>
        <Field label="Quận/huyện"><input className="input" maxLength={160} value={value.district ?? ''} onChange={set('district')} /></Field>
        <Field label="Mã bưu chính" hint="5 số, có thể bỏ trống"><input className="input" pattern="\d{5}" value={value.postalCode ?? ''} onChange={set('postalCode')} /></Field>
        <label className="check span-2">
          <input type="checkbox" checked={value.defaultAddress} onChange={(e) => setValue({ ...value, defaultAddress: e.target.checked })} />
          Đặt làm địa chỉ mặc định
        </label>
      </form>
      <ErrorBox error={provinceError} />
      <ErrorBox error={error} />
      <Action onError={setError} onClick={() => {
        const problems = addressProblems(value);
        if (problems.length) throw new Error(problems.join(' '));
        const trimmed = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) as AddressInput;
        return onSave(trimmed);
      }}>Lưu địa chỉ</Action>
    </Modal>
  );
}
