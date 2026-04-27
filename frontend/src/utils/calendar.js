

export function isSameDay(dateStr, day) {
    const d = new Date(dateStr);
    return d.getFullYear() === day.getFullYear()
        && d.getMonth() === day.getMonth()
        && d.getDate() === day.getDate();
}

export function getWeekDays(offset = 0) {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay() + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        return d;
    });
}

export function getMonthMatrix(date = new Date()){
    const year = date.getFullYear();
    const month = date.getMonth();

    const first = new Date(year, month, 1);
    const last = new Date(year, month+1, 0);
    const startDay = new Date(first);
    startDay.setDate(first.getDate() - first.getDay());

    const weeks = [];
    let currentDay = new Date(startDay);

    while (currentDay <= last) {
        const week = [];
        for (let d = 0; d < 7; d++) {
            week.push(new Date(currentDay));
            currentDay.setDate(currentDay.getDate() + 1);
        }
        weeks.push(week);
    }

    return weeks;
}