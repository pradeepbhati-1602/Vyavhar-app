// Generic Node class for LinkedList
public class Node<T> {
    T data;
    Node<T> next;

    // Constructor
    public Node(T data) {
        this.data = data;
        this.next = null;
    }

    // Getter for data
    public T getData() {
        return data;
    }

    // Setter for data
    public void setData(T data) {
        this.data = data;
    }

    // Getter for next
    public Node<T> getNext() {
        return next;
    }

    // Setter for next
    public void setNext(Node<T> next) {
        this.next = next;
    }
}

// Example usage in LinkedList class
class LinkedList<T> {
    private Node<T> head;

    // Constructor
    public LinkedList() {
        this.head = null;
    }

    // Insert at the beginning
    public void insertAtBeginning(T data) {
        Node<T> newNode = new Node<>(data);
        newNode.setNext(head);
        head = newNode;
    }

    // Insert at the end
    public void insertAtEnd(T data) {
        Node<T> newNode = new Node<>(data);
        if (head == null) {
            head = newNode;
            return;
        }
        Node<T> current = head;
        while (current.getNext() != null) {
            current = current.getNext();
        }
        current.setNext(newNode);
    }

    // Display the linked list
    public void display() {
        Node<T> current = head;
        while (current != null) {
            System.out.print(current.getData() + " -> ");
            current = current.getNext();
        }
        System.out.println("null");
    }

    // Main method for testing
    public static void main(String[] args) {
        LinkedList<Integer> list = new LinkedList<>();

        // Adding elements
        list.insertAtBeginning(10);
        list.insertAtEnd(20);
        list.insertAtEnd(30);
        list.insertAtBeginning(5);

        // Display the list
        System.out.println("LinkedList:");
        list.display();
    }
}
