import { IS_STATIC_DEMO } from "./demo-mode.ts";
import type { AccountMandate, SpendingAccount } from "@mandate/shared";
import { SmartAccountAddress } from "./SmartAccountAddress.tsx";
import { SecretMandateId } from "./SecretMandateId.tsx";

export function MandateDetails({ mandate, account, mandateId, agentName, onClose }: {
  mandate: AccountMandate; account: SpendingAccount; mandateId?: string; agentName?: string; onClose: () => void;
}) {
  const payUrl = `${window.location.origin}/pay`;
  if (!mandateId) return <div className="form">
    <p>{agentName ?? "The agent"} can now spend {mandate.currency ?? account.currency} from <strong>{account.name}</strong>.</p>
    <p className="form-note">{IS_STATIC_DEMO ? "This simulated mandate is assigned to a demo agent. No real signing keys or blockchain transactions are used." : <>Only {agentName ?? "the agent"}'s own key can sign for this mandate, so there is no secret ID to share and Mandate cannot spend it. The limit, expiry and sellers are enforced on Stellar testnet.</>}</p>
    <p className="muted">Allowed sellers: {mandate.sellerIds?.length ? `seller IDs ${mandate.sellerIds.join(", ")}, ${IS_STATIC_DEMO ? "simulated" : "enforced on chain"}` : "any verified seller"}</p>
    <SmartAccountAddress address={account.address ?? account.id} label="Source Smart Account address" />
    <div className="form-actions"><button className="button is-primary" type="button" onClick={onClose}>Done</button></div>
  </div>;
  return <div className="form">
    <p>The mandate is ready and spends {mandate.currency ?? account.currency} from <strong>{account.name}</strong>.</p>
    <p className="form-note">{IS_STATIC_DEMO ? "Agent identification, spending limits, and approved sellers are simulated in this browser." : "Agent identification, spending limits and verified recipients are enforced on Stellar testnet."}</p>
    <p className="muted">Allowed seller IDs: {mandate.sellerIds?.length ? mandate.sellerIds.join(", ") : "Any verified seller"}</p>
    <SecretMandateId reference={mandate.reference} initialValue={mandateId} />
    <p className="form-note">{IS_STATIC_DEMO ? "This demo ID is only for simulated payments in this browser. It cannot authorize real payments." : "The mandate ID authorizes payments. Keep it private and give it only to the intended holder. The Pay link does not contain it."}</p>
    <p className="muted">Payments also require an agent identification value from the Agents tab. Any agent registered to this account can use the mandate.</p>
    <label className="field">Payment page link<input readOnly value={payUrl} onFocus={event => event.target.select()} /></label>
    <SmartAccountAddress address={account.address ?? account.id} label="Source Smart Account address" />
    <div className="form-actions"><button className="button is-primary" type="button" onClick={onClose}>Done</button></div>
  </div>;
}
