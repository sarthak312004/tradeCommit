import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <h1 className='text-2xl font-bold underline italic '>TradeCommit</h1>
    <div className='h-50 w-50 bg-white rounded-2xl'>
      <p className='text-black'>Trade Card</p>
    </div>
    </>
  )
}

export default App
