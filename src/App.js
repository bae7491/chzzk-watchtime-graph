import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home/Home';
import ChannelSearch from './pages/ChannelSearch/ChannelSearch';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path='/search' element={<ChannelSearch />} />
            </Routes>
        </BrowserRouter>
    );
}