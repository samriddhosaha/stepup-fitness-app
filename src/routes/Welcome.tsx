import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex flex-col justify-between py-10">
      <div>
        <p className="font-display text-4xl leading-tight mb-4">StepUp</p>
        <p className="text-lg text-ink/80 max-w-sm">
          A personal trainer that lives in your phone.
        </p>
      </div>

      <div className="space-y-4">
        <p className="font-display text-2xl leading-snug">
          Nothing to prove today. Just begin.
        </p>
        <p className="text-sm text-faint max-w-sm">
          Your data — it stays on this device. No account, no email, nothing
          to sign up for. StepUp builds your plan from a few questions and
          keeps everything local from there.
        </p>
      </div>

      <Button className="w-full" onClick={() => navigate('/onboarding')}>
        Get started
      </Button>
    </div>
  )
}
