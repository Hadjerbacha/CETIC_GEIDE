import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaTrash, FaEdit, FaSave } from "react-icons/fa";

const Details = () => {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Checklist (sous-tâches)
  const [todoInput, setTodoInput] = useState("");
  const [todos, setTodos] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    const fetchTaskDetails = async () => {
      try {
        const token = localStorage.getItem("token");

        const response = await axios.get("http://localhost:5000/api/tasks/", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const allTasks = response.data;
        const foundTask = allTasks.find((t) => t.id.toString() === id);
        if (foundTask) {
          setTask(foundTask);
        } else {
          setError("Tâche introuvable");
        }
      } catch (err) {
        setError("Erreur lors de la récupération des données");
      } finally {
        setLoading(false);
      }
    };

    const fetchListTasks = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `http://localhost:5000/api/list-tasks/${id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setTodos(response.data);
      } catch (err) {
        console.error("Erreur lors de la récupération des sous-tâches");
      }
    };

    fetchTaskDetails().then(fetchListTasks);
  }, [id]);

  const handleAddTodo = async () => {
    if (todoInput.trim() !== "") {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.post(
          "http://localhost:5000/api/list-tasks",
          {
            task_id: id,
            description: todoInput.trim(),
            is_done: false,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setTodos([...todos, response.data]);
        setTodoInput("");
      } catch (err) {
        console.error("Erreur lors de l’ajout de la sous-tâche");
      }
    }
  };

  const toggleTodo = async (index) => {
    const todo = todos[index];
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `http://localhost:5000/api/list-tasks/${todo.id}`,
        {
          description: todo.description,
          is_done: !todo.is_done,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const updated = [...todos];
      updated[index] = response.data;
      setTodos(updated);
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut");
    }
  };

  const deleteTodo = async (idToDelete) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/api/list-tasks/${idToDelete}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTodos(todos.filter((todo) => todo.id !== idToDelete));
    } catch (err) {
      console.error("Erreur lors de la suppression de la sous-tâche");
    }
  };

  const startEditing = (index, currentText) => {
    setEditingIndex(index);
    setEditingText(currentText);
  };

  const saveEdit = async (index) => {
    const todo = todos[index];
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `http://localhost:5000/api/list-tasks/${todo.id}`,
        {
          description: editingText,
          is_done: todo.is_done,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const updated = [...todos];
      updated[index] = response.data;
      setTodos(updated);
      setEditingIndex(null);
      setEditingText("");
    } catch (err) {
      console.error("Erreur lors de l’édition de la sous-tâche");
    }
  };

  if (loading) return <div className="container mt-5">Chargement...</div>;
  if (error) return <div className="container mt-5 text-danger">{error}</div>;

  return (
    <div className="container-fluid">
      <div className="m-4">
        <a href="/workflows" className="btn btn-secondary btn-lg w-100">
          Retour
        </a>
      </div>

      <div className="row justify-content-center px-3">
        {/* Détails Tâche */}
        <div className="col-md-6 mb-4">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-primary text-white">
              <h4>Détails de la Tâche</h4>
            </div>
            <div className="card-body">
              <p><strong>ID :</strong> {task.id}</p>
              <p><strong>Nom :</strong> {task.title}</p>
              <p><strong>Description :</strong> {task.description}</p>
              <p><strong>Date d'échéance :</strong> {new Date(task.due_date).toLocaleString()}</p>
              <p><strong>Priorité :</strong> {task.priority}</p>
              <p><strong>Fichier :</strong> {task.file ? (
                <a href={`http://localhost:5000/${task.file}`} target="_blank" rel="noopener noreferrer">Télécharger</a>
              ) : "Aucun fichier"}</p>
              <p><strong>Statut :</strong> {task.status}</p>
              <p><strong>Assignée à :</strong> {task.assigned_to ? task.assigned_to.name : "Non assignée"}</p>
              <p><strong>Assignée par :</strong> {task.assigned_by ? task.assigned_by.name : "Non assignée"}</p>
              <p><strong>Date de création :</strong> {new Date(task.created_at).toLocaleString()}</p>
              <p><strong>Notes :</strong> {task.assignment_note ? task.assignment_note : "Aucune note"}</p>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="col-md-6 mb-4">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-success text-white">
              <h5>Checklist / Sous-tâches</h5>
            </div>
            <div className="card-body">
              <div className="input-group mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ajouter une sous-tâche..."
                  value={todoInput}
                  onChange={(e) => setTodoInput(e.target.value)}
                />
                <button className="btn btn-success" onClick={handleAddTodo}>
                  Ajouter
                </button>
              </div>

              {todos.length > 0 ? (
                <ul className="list-group">
                  {todos.map((todo, index) => (
                    <li
                      key={todo.id}
                      className={`list-group-item d-flex justify-content-between align-items-center ${
                        todo.is_done ? "list-group-item-success" : ""
                      }`}
                    >
                      <div className="d-flex align-items-center w-100">
                        <input
                          type="checkbox"
                          className="form-check-input me-2"
                          checked={todo.is_done}
                          onChange={() => toggleTodo(index)}
                        />
                        {editingIndex === index ? (
                          <input
                            type="text"
                            className="form-control me-2"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(index);
                            }}
                          />
                        ) : (
                          <span
                            className="flex-grow-1"
                            style={{
                              textDecoration: todo.is_done ? "line-through" : "none",
                            }}
                          >
                            {todo.description}
                          </span>
                        )}
                      </div>
                      <div className="ms-2 d-flex gap-2">
                        {editingIndex === index ? (
                            <FaSave
                            className="text-success"
                            style={{ cursor: "pointer" }}
                            onClick={() => saveEdit(index)}
                            />
                        ) : (
                            <FaEdit
                            className="text-primary"
                            style={{ cursor: "pointer" }}
                            onClick={() => startEditing(index, todo.description)}
                            />
                        )}
                        <FaTrash
                            className="text-danger"
                            style={{ cursor: "pointer" }}
                            onClick={() => deleteTodo(todo.id)}
                        />
                        </div>

                    </li>
                  ))}
                </ul>
              ) : (
                <p>Aucune sous-tâche ajoutée.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Details;
