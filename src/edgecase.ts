


export interface Dummy {
    hi: 1
}

export interface Extensive extends Dummy {
    bye: 2
}


class Impl<T extends Dummy = Dummy> {
    test<K extends keyof T>(key: K, val: T[K]) {
        console.log(key, val);
    }
}


const test: Impl<Extensive> = new Impl();

test.test("hi", 1);